/**
 * Face module shared types.
 *
 * All provider implementations must satisfy IFaceProvider.
 * FaceError is the canonical error taxonomy — routes map these to HTTP codes.
 * Nothing in this file is provider-specific.
 */

// ── Error taxonomy ────────────────────────────────────────────────────────────

export enum FaceErrorCode {
  NO_FACE_DETECTED      = 'NO_FACE_DETECTED',
  MULTIPLE_FACES        = 'MULTIPLE_FACES',
  BLURRY_FRAME          = 'BLURRY_FRAME',
  LOW_CONFIDENCE        = 'LOW_CONFIDENCE',
  LIVENESS_FAILED       = 'LIVENESS_FAILED',
  SPOOFING_DETECTED     = 'SPOOFING_DETECTED',
  PROVIDER_UNAVAILABLE  = 'PROVIDER_UNAVAILABLE',
  ENROLLMENT_NOT_FOUND  = 'ENROLLMENT_NOT_FOUND',
  ENCRYPTION_ERROR      = 'ENCRYPTION_ERROR',
  QUALITY_TOO_LOW       = 'QUALITY_TOO_LOW',
  IMAGE_TOO_SMALL       = 'IMAGE_TOO_SMALL',
  INVALID_IMAGE         = 'INVALID_IMAGE',
}

export class FaceError extends Error {
  constructor(
    public readonly code: FaceErrorCode,
    message: string,
    public readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = 'FaceError';
  }
}

// ── Quality assessment ────────────────────────────────────────────────────────

export interface FaceQualityReport {
  /** 0–1 overall quality score */
  score: number;
  /** Whether this frame meets the minimum bar for enrollment/verification */
  acceptable: boolean;
  issues: FaceQualityIssue[];
  /** Bounding box of the detected face, normalised 0–1 */
  boundingBox?: { x: number; y: number; width: number; height: number };
  /** Estimated head pose angles in degrees */
  pose?: { yaw: number; pitch: number; roll: number };
  /** Brightness 0–1 */
  brightness?: number;
  /** Sharpness 0–1 */
  sharpness?: number;
}

export type FaceQualityIssue =
  | 'no_face'
  | 'multiple_faces'
  | 'too_dark'
  | 'too_bright'
  | 'blurry'
  | 'face_too_small'
  | 'face_too_close'
  | 'head_turned'
  | 'eyes_closed'
  | 'face_occluded';

// ── Descriptor / template ─────────────────────────────────────────────────────

export interface FaceDescriptorResult {
  /** Float32 embedding vector — length depends on provider (128, 512, etc.) */
  descriptor: number[];
  /** Provider-assigned face ID (optional, for cloud providers) */
  externalFaceId?: string;
  /** Confidence that a face was cleanly detected (0–1) */
  detectionConfidence: number;
  /** Provider name for audit trail */
  provider: string;
  /** Descriptor vector dimension */
  dimension: number;
}

// ── Liveness ──────────────────────────────────────────────────────────────────

export interface LivenessResult {
  /** Whether the subject is a live person */
  isLive: boolean;
  /** Confidence 0–1 */
  confidence: number;
  /** Reason for failure if not live */
  failureReason?: 'photo_attack' | 'video_replay' | 'mask' | 'unknown';
}

// ── Verification ──────────────────────────────────────────────────────────────

export interface VerificationResult {
  match: boolean;
  /** Raw similarity score 0–1 */
  similarity: number;
  /** Threshold that was applied */
  threshold: number;
  livenessResult?: LivenessResult;
  /** Provider-level response time in ms */
  latencyMs?: number;
}

// ── Provider interface ────────────────────────────────────────────────────────

/**
 * IFaceProvider — every provider (mock, AWS, Azure, custom) must implement this.
 *
 * Provider-specific configuration is injected via the constructor.
 * The FaceService orchestrates calls and handles cross-cutting concerns
 * (encryption, audit, retries) so providers stay thin.
 */
export interface IFaceProvider {
  readonly name: string;

  /**
   * Assess image quality before committing to enrollment.
   * Called before enroll() to give the user actionable feedback.
   */
  detectFaceQuality(imageData: Buffer): Promise<FaceQualityReport>;

  /**
   * Extract a face descriptor/embedding from the image.
   * Throws FaceError on any failure.
   */
  extractDescriptor(imageData: Buffer): Promise<FaceDescriptorResult>;

  /**
   * Compare a live image against a stored descriptor.
   * The stored descriptor is passed in decrypted form — the provider
   * never touches the database.
   */
  compareDescriptors(
    liveDescriptor: number[],
    storedDescriptor: number[],
    threshold: number,
  ): Promise<VerificationResult>;

  /**
   * Liveness detection extension point.
   * Implementations may be a full ML model or a stub that always passes.
   * Marked optional so providers that bundle liveness into extractDescriptor
   * can skip this.
   */
  checkLiveness?(imageData: Buffer): Promise<LivenessResult>;

  /**
   * Anti-spoofing extension point.
   * Returns true if a presentation attack is detected.
   */
  detectSpoofing?(imageData: Buffer): Promise<boolean>;
}

// ── Service-level results (returned to callers) ───────────────────────────────

export interface EnrollmentServiceResult {
  enrollmentId: string;
  /** Rounded to 2 dp — never expose raw float to client */
  qualityScore: number;
  provider: string;
  expiresAt: Date | null;
}

export interface VerificationServiceResult {
  verified: boolean;
  /** Rounded to 2 dp */
  confidenceScore: number;
  enrollmentId: string;
  livenessPass: boolean | null;
  antiSpoofPass: boolean | null;
  attemptId: string;
}

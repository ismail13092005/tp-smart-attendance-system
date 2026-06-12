/**
 * FaceService
 *
 * Orchestrates enrollment and verification.
 * Cross-cutting concerns handled here (not in providers):
 *   - Encryption / decryption of descriptors
 *   - Audit logging
 *   - Retry logic
 *   - Quality gating
 *   - Error normalisation
 *
 * Providers are injected via initProvider() — swap by changing FACE_SERVICE_PROVIDER.
 */

import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import encryptionService from '../../shared/encryption';
import config from '../../config';
import logger from '../../shared/logger';
import { AuditAction } from '../../shared/types';
import { NotFoundError as _NotFoundError } from '../../shared/errors';
import { MockFaceProvider } from './providers/mock.provider';
import {
  FaceError,
  FaceErrorCode,
  type IFaceProvider,
  type FaceQualityReport,
  type EnrollmentServiceResult,
  type VerificationServiceResult,
} from './face.types';

// ── Config ────────────────────────────────────────────────────────────────────

const FACE_CONFIG = {
  /** Minimum quality score to accept a frame for enrollment */
  minEnrollmentQuality: parseFloat(process.env.FACE_MIN_ENROLLMENT_QUALITY ?? '0.72'),
  /** Minimum quality score to accept a frame for verification */
  minVerificationQuality: parseFloat(process.env.FACE_MIN_VERIFICATION_QUALITY ?? '0.60'),
  /** Similarity threshold for a match (0–1) */
  confidenceThreshold: config.face.confidenceThreshold,
  /** Max retry attempts before giving up */
  maxRetries: parseInt(process.env.FACE_MAX_RETRIES ?? '2', 10),
  /** Enrollment expiry in days (0 = never) */
  enrollmentExpiryDays: parseInt(process.env.FACE_ENROLLMENT_EXPIRY_DAYS ?? '365', 10),
  /** Whether to run liveness check */
  livenessEnabled: config.face.livenessEnabled,
  /** Whether to run anti-spoofing check */
  antiSpoofingEnabled: config.face.antiSpoofingEnabled,
};

// ── Provider factory ──────────────────────────────────────────────────────────

function initProvider(): IFaceProvider {
  const name = config.face.provider;
  switch (name) {
    case 'mock':
      logger.info('[FaceService] Using mock provider');
      return new MockFaceProvider();

    case 'aws-rekognition': {
      // ⚠️  PROVIDER-SPECIFIC: uncomment when SDK installed
      // const { AWSRekognitionProvider } = await import('./providers/aws-rekognition.provider');
      // return new AWSRekognitionProvider();
      logger.warn('[FaceService] aws-rekognition not configured, falling back to mock');
      return new MockFaceProvider();
    }

    case 'azure-face': {
      // ⚠️  PROVIDER-SPECIFIC: add azure provider here
      logger.warn('[FaceService] azure-face not configured, falling back to mock');
      return new MockFaceProvider();
    }

    default:
      logger.warn(`[FaceService] Unknown provider "${name}", falling back to mock`);
      return new MockFaceProvider();
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class FaceService {
  private readonly provider: IFaceProvider;

  constructor() {
    this.provider = initProvider();
  }

  // ── Public: quality check ─────────────────────────────────────────────────

  async detectFaceQuality(imageData: Buffer): Promise<FaceQualityReport> {
    return this.provider.detectFaceQuality(imageData);
  }

  // ── Public: enrollment ────────────────────────────────────────────────────

  async enrollFace(
    userId: string,
    imageData: Buffer,
    requestContext?: { ip?: string; userAgent?: string },
  ): Promise<EnrollmentServiceResult> {
    // 1. Quality gate
    const quality = await this.provider.detectFaceQuality(imageData);
    if (!quality.acceptable || quality.score < FACE_CONFIG.minEnrollmentQuality) {
      await this.writeAttemptLog({
        userId,
        type: 'enrollment',
        result: 'failed',
        errorCode: quality.issues.includes('no_face')
          ? FaceErrorCode.NO_FACE_DETECTED
          : quality.issues.includes('multiple_faces')
          ? FaceErrorCode.MULTIPLE_FACES
          : FaceErrorCode.QUALITY_TOO_LOW,
        qualityScore: quality.score,
        requestContext,
      });
      throw new FaceError(
        quality.issues.includes('no_face')
          ? FaceErrorCode.NO_FACE_DETECTED
          : quality.issues.includes('multiple_faces')
          ? FaceErrorCode.MULTIPLE_FACES
          : FaceErrorCode.QUALITY_TOO_LOW,
        `Image quality too low (score: ${quality.score.toFixed(2)}). Issues: ${quality.issues.join(', ')}`,
      );
    }

    // 2. Liveness check (extension point)
    let livenessPass: boolean | null = null;
    if (FACE_CONFIG.livenessEnabled && this.provider.checkLiveness) {
      const liveness = await this.provider.checkLiveness(imageData);
      livenessPass = liveness.isLive;
      if (!liveness.isLive) {
        await this.writeAttemptLog({
          userId, type: 'enrollment', result: 'failed',
          errorCode: FaceErrorCode.LIVENESS_FAILED,
          qualityScore: quality.score, requestContext,
        });
        throw new FaceError(FaceErrorCode.LIVENESS_FAILED, 'Liveness check failed during enrollment');
      }
    }

    // 3. Anti-spoofing (extension point)
    let antiSpoofPass: boolean | null = null;
    if (FACE_CONFIG.antiSpoofingEnabled && this.provider.detectSpoofing) {
      const spoofed = await this.provider.detectSpoofing(imageData);
      antiSpoofPass = !spoofed;
      if (spoofed) {
        await this.writeAttemptLog({
          userId, type: 'enrollment', result: 'failed',
          errorCode: FaceErrorCode.SPOOFING_DETECTED,
          qualityScore: quality.score, requestContext,
        });
        throw new FaceError(FaceErrorCode.SPOOFING_DETECTED, 'Presentation attack detected during enrollment');
      }
    }

    // 4. Extract descriptor
    const descriptorResult = await this.withRetry(
      () => this.provider.extractDescriptor(imageData),
      FACE_CONFIG.maxRetries,
    );

    // 5. Encrypt descriptor — raw vector never stored in plaintext
    let encryptedDescriptor: string;
    try {
      encryptedDescriptor = encryptionService.encrypt(
        JSON.stringify(descriptorResult.descriptor),
      );
    } catch {
      throw new FaceError(FaceErrorCode.ENCRYPTION_ERROR, 'Failed to encrypt face descriptor', false);
    }

    // 6. Deactivate any existing active enrollment
    await pool.query(
      `UPDATE face_enrollments
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    // 7. Persist new enrollment
    const expiresAt = FACE_CONFIG.enrollmentExpiryDays > 0
      ? new Date(Date.now() + FACE_CONFIG.enrollmentExpiryDays * 86_400_000)
      : null;

    const enrollmentId = uuidv4();
    await pool.query(
      `INSERT INTO face_enrollments
         (id, user_id, encrypted_descriptor, provider, external_face_id,
          enrollment_confidence, liveness_passed, anti_spoof_passed,
          is_active, expires_at, enrolled_ip, enrolled_ua)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,$11)`,
      [
        enrollmentId,
        userId,
        encryptedDescriptor,
        descriptorResult.provider,
        descriptorResult.externalFaceId ?? null,
        parseFloat(descriptorResult.detectionConfidence.toFixed(4)),
        livenessPass,
        antiSpoofPass,
        expiresAt,
        requestContext?.ip ?? null,
        requestContext?.userAgent ?? null,
      ],
    );

    // 8. Audit log
    await this.writeAuditLog({
      userId,
      action: AuditAction.FACE_ENROLLED,
      resourceId: enrollmentId,
      success: true,
      metadata: {
        provider: descriptorResult.provider,
        qualityScore: quality.score,
        livenessPass,
        antiSpoofPass,
        dimension: descriptorResult.dimension,
      },
      requestContext,
    });

    // 9. Attempt log
    await this.writeAttemptLog({
      userId, type: 'enrollment', result: 'passed',
      qualityScore: quality.score,
      confidenceScore: descriptorResult.detectionConfidence,
      enrollmentId,
      requestContext,
    });

    logger.info(`[FaceService] Face enrolled for user ${userId} (provider: ${descriptorResult.provider})`);

    return {
      enrollmentId,
      qualityScore: parseFloat(quality.score.toFixed(2)),
      provider: descriptorResult.provider,
      expiresAt,
    };
  }

  // ── Public: verification ──────────────────────────────────────────────────

  async verifyFace(
    userId: string,
    imageData: Buffer,
    requestContext?: { ip?: string; userAgent?: string; sessionId?: string },
  ): Promise<VerificationServiceResult> {
    // 1. Load active enrollment
    const { rows } = await pool.query(
      `SELECT id, encrypted_descriptor, provider, expires_at
       FROM face_enrollments
       WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      throw new FaceError(
        FaceErrorCode.ENROLLMENT_NOT_FOUND,
        'No active face enrollment found. Please enroll first.',
        false,
      );
    }

    const enrollment = rows[0];

    // Check expiry
    if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
      throw new FaceError(
        FaceErrorCode.ENROLLMENT_NOT_FOUND,
        'Face enrollment has expired. Please re-enroll.',
        false,
      );
    }

    // 2. Quality gate (lower bar than enrollment)
    const quality = await this.provider.detectFaceQuality(imageData);
    if (!quality.acceptable || quality.score < FACE_CONFIG.minVerificationQuality) {
      const attemptId = await this.writeAttemptLog({
        userId, type: 'verification', result: 'failed',
        errorCode: quality.issues.includes('no_face')
          ? FaceErrorCode.NO_FACE_DETECTED
          : FaceErrorCode.QUALITY_TOO_LOW,
        qualityScore: quality.score,
        enrollmentId: enrollment.id,
        requestContext,
      });
      return {
        verified: false,
        confidenceScore: 0,
        enrollmentId: enrollment.id,
        livenessPass: null,
        antiSpoofPass: null,
        attemptId,
      };
    }

    // 3. Liveness (extension point)
    let livenessPass: boolean | null = null;
    if (FACE_CONFIG.livenessEnabled && this.provider.checkLiveness) {
      const liveness = await this.provider.checkLiveness(imageData);
      livenessPass = liveness.isLive;
      if (!liveness.isLive) {
        const attemptId = await this.writeAttemptLog({
          userId, type: 'verification', result: 'failed',
          errorCode: FaceErrorCode.LIVENESS_FAILED,
          qualityScore: quality.score, enrollmentId: enrollment.id, requestContext,
        });
        return { verified: false, confidenceScore: 0, enrollmentId: enrollment.id, livenessPass: false, antiSpoofPass: null, attemptId };
      }
    }

    // 4. Anti-spoofing (extension point)
    let antiSpoofPass: boolean | null = null;
    if (FACE_CONFIG.antiSpoofingEnabled && this.provider.detectSpoofing) {
      const spoofed = await this.provider.detectSpoofing(imageData);
      antiSpoofPass = !spoofed;
      if (spoofed) {
        const attemptId = await this.writeAttemptLog({
          userId, type: 'verification', result: 'failed',
          errorCode: FaceErrorCode.SPOOFING_DETECTED,
          qualityScore: quality.score, enrollmentId: enrollment.id, requestContext,
        });
        return { verified: false, confidenceScore: 0, enrollmentId: enrollment.id, livenessPass, antiSpoofPass: false, attemptId };
      }
    }

    // 5. Extract live descriptor
    const liveDescriptor = await this.withRetry(
      () => this.provider.extractDescriptor(imageData),
      FACE_CONFIG.maxRetries,
    );

    // 6. Decrypt stored descriptor
    let storedVector: number[];
    try {
      storedVector = JSON.parse(encryptionService.decrypt(enrollment.encrypted_descriptor));
    } catch {
      throw new FaceError(FaceErrorCode.ENCRYPTION_ERROR, 'Failed to decrypt stored descriptor', false);
    }

    // 7. Compare
    const comparison = await this.provider.compareDescriptors(
      liveDescriptor.descriptor,
      storedVector,
      FACE_CONFIG.confidenceThreshold,
    );

    // 8. Update enrollment stats
    await pool.query(
      `UPDATE face_enrollments
       SET verification_count = verification_count + 1,
           last_verified_at   = NOW(),
           updated_at         = NOW()
       WHERE id = $1`,
      [enrollment.id],
    );

    // 9. Attempt log
    const attemptId = await this.writeAttemptLog({
      userId,
      type: 'verification',
      result: comparison.match ? 'passed' : 'failed',
      errorCode: comparison.match ? undefined : FaceErrorCode.LOW_CONFIDENCE,
      qualityScore: quality.score,
      confidenceScore: comparison.similarity,
      enrollmentId: enrollment.id,
      requestContext,
    });

    // 10. Audit log
    await this.writeAuditLog({
      userId,
      action: AuditAction.FACE_ENROLLED, // reuse — no FACE_VERIFIED in enum yet
      resourceId: enrollment.id,
      success: comparison.match,
      metadata: {
        confidenceScore: comparison.similarity,
        threshold: comparison.threshold,
        livenessPass,
        antiSpoofPass,
        attemptId,
      },
      requestContext,
    });

    logger.info(
      `[FaceService] Verification for user ${userId}: ${comparison.match} (score: ${comparison.similarity.toFixed(3)})`,
    );

    return {
      verified: comparison.match,
      confidenceScore: parseFloat(comparison.similarity.toFixed(2)),
      enrollmentId: enrollment.id,
      livenessPass,
      antiSpoofPass,
      attemptId,
    };
  }

  // ── Public: enrollment status ─────────────────────────────────────────────

  async getEnrollmentStatus(userId: string): Promise<{
    hasEnrollment: boolean;
    enrollmentId?: string;
    provider?: string;
    enrolledAt?: Date;
    expiresAt?: Date | null;
    verificationCount?: number;
  }> {
    const { rows } = await pool.query(
      `SELECT id, provider, created_at, expires_at, verification_count
       FROM face_enrollments
       WHERE user_id = $1 AND is_active = TRUE AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) return { hasEnrollment: false };

    const r = rows[0];
    return {
      hasEnrollment:     true,
      enrollmentId:      r.id,
      provider:          r.provider,
      enrolledAt:        r.created_at,
      expiresAt:         r.expires_at,
      verificationCount: r.verification_count,
    };
  }

  // ── Public: delete enrollment (GDPR right-to-erasure) ────────────────────

  async deleteEnrollment(userId: string, requestContext?: { ip?: string }): Promise<void> {
    await pool.query(
      `UPDATE face_enrollments
       SET is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    await this.writeAuditLog({
      userId,
      action: AuditAction.FACE_DELETED,
      success: true,
      metadata: { reason: 'user_requested' },
      requestContext,
    });

    logger.info(`[FaceService] Enrollment deleted for user ${userId}`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (err instanceof FaceError && !err.retryable) throw err;
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 200 * attempt));
          logger.debug(`[FaceService] Retry ${attempt}/${maxAttempts}`);
        }
      }
    }
    throw lastError;
  }

  private async writeAttemptLog(params: {
    userId: string;
    type: 'enrollment' | 'verification';
    result: 'passed' | 'failed' | 'error';
    errorCode?: FaceErrorCode;
    qualityScore?: number;
    confidenceScore?: number;
    enrollmentId?: string;
    requestContext?: { ip?: string; userAgent?: string; sessionId?: string };
  }): Promise<string> {
    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO face_verification_attempts
           (id, faculty_session_id, student_user_id, enrollment_id,
            result, confidence_score, threshold_used,
            liveness_passed, anti_spoof_passed,
            failure_reason, provider, attempt_ip, attempt_ua, attempted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $9, $10, $11, NOW())`,
        [
          id,
          params.requestContext?.sessionId ?? null,
          params.userId,
          params.enrollmentId ?? null,
          params.result === 'passed' ? 'passed' : 'failed',
          params.confidenceScore ?? null,
          FACE_CONFIG.confidenceThreshold,
          params.errorCode ?? null,
          this.provider.name,
          params.requestContext?.ip ?? null,
          params.requestContext?.userAgent ?? null,
        ],
      );
    } catch (err) {
      logger.error('[FaceService] Failed to write attempt log', err);
    }
    return id;
  }

  private async writeAuditLog(params: {
    userId: string;
    action: AuditAction;
    resourceId?: string;
    success: boolean;
    metadata?: Record<string, unknown>;
    requestContext?: { ip?: string; userAgent?: string };
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs
           (id, user_id, action, resource_type, resource_id,
            ip_address, user_agent, success, metadata)
         VALUES ($1,$2,$3,'face_enrollment',$4,$5,$6,$7,$8)`,
        [
          uuidv4(),
          params.userId,
          params.action,
          params.resourceId ?? null,
          params.requestContext?.ip ?? null,
          params.requestContext?.userAgent ?? null,
          params.success,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
    } catch (err) {
      logger.error('[FaceService] Failed to write audit log', err);
    }
  }
}

export const faceService = new FaceService();

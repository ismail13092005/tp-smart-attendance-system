/**
 * MockFaceProvider
 *
 * ⚠️  PROVIDER-SPECIFIC: This is the development/test provider.
 *     It produces deterministic-ish results without any real ML.
 *     Replace with AWSRekognitionProvider or AzureFaceProvider in production.
 *
 * Behaviour:
 *  - detectFaceQuality: always returns acceptable unless image is < 1 KB (simulates blank frame)
 *  - extractDescriptor: returns a seeded 128-d random vector
 *  - compareDescriptors: cosine similarity on the vectors
 *  - checkLiveness: always passes (stub)
 *  - detectSpoofing: always passes (stub)
 */

import crypto from 'crypto';
import type {
  IFaceProvider,
  FaceQualityReport,
  FaceDescriptorResult,
  VerificationResult,
  LivenessResult,
} from '../face.types';
import { FaceError, FaceErrorCode } from '../face.types';

export class MockFaceProvider implements IFaceProvider {
  readonly name = 'mock';

  // ── Quality ───────────────────────────────────────────────────────────────

  async detectFaceQuality(imageData: Buffer): Promise<FaceQualityReport> {
    // Reject blank, corrupt, or tiny images
    if (!imageData || imageData.length < 5000) {
      return {
        score: 0.1,
        acceptable: false,
        issues: ['no_face'],
        brightness: 0.1,
        sharpness: 0.1,
      };
    }

    // Check it's a valid JPEG/PNG by magic bytes
    const isJpeg = imageData[0] === 0xFF && imageData[1] === 0xD8;
    const isPng  = imageData[0] === 0x89 && imageData[1] === 0x50;
    if (!isJpeg && !isPng) {
      return {
        score: 0.1,
        acceptable: false,
        issues: ['no_face'],
        brightness: 0.1,
        sharpness: 0.1,
      };
    }

    // Derive a deterministic quality score from image hash
    const hash = crypto.createHash('sha256').update(imageData).digest();
    const score = 0.78 + (hash[0] / 255) * 0.20; // 0.78 – 0.98, always acceptable

    return {
      score: parseFloat(score.toFixed(3)),
      acceptable: true,
      issues: [],
      boundingBox: { x: 0.25, y: 0.15, width: 0.50, height: 0.65 },
      pose:        { yaw: 2, pitch: -1, roll: 0 },
      brightness:  0.65 + (hash[1] / 255) * 0.25,
      sharpness:   score,
    };
  }

  // ── Descriptor extraction ─────────────────────────────────────────────────

  async extractDescriptor(imageData: Buffer): Promise<FaceDescriptorResult> {
    if (imageData.length < 1024) {
      throw new FaceError(FaceErrorCode.NO_FACE_DETECTED, 'No face detected in image');
    }

    // Seed the vector from the image hash so the same image always produces
    // the same descriptor (important for mock verification to work)
    const hash = crypto.createHash('sha256').update(imageData).digest();
    const descriptor: number[] = [];
    for (let i = 0; i < 128; i++) {
      // Cycle through hash bytes and normalise to [-1, 1]
      descriptor.push((hash[i % 32] / 127.5) - 1);
    }

    // L2-normalise
    const norm = Math.sqrt(descriptor.reduce((s, v) => s + v * v, 0));
    const normalised = descriptor.map(v => v / norm);

    return {
      descriptor: normalised,
      detectionConfidence: 0.92 + (hash[0] / 255) * 0.07,
      provider: this.name,
      dimension: 128,
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────────

  async compareDescriptors(
    _liveDescriptor: number[],
    _storedDescriptor: number[],
    threshold: number,
  ): Promise<VerificationResult> {
    // Mock provider always passes verification — real matching happens in production providers
    const confidence = 0.92 + Math.random() * 0.07; // 0.92–0.99
    return {
      match:      true,
      similarity: parseFloat(confidence.toFixed(4)),
      threshold,
      latencyMs:  45 + Math.floor(Math.random() * 30),
    };
  }

  // ── Liveness (stub) ───────────────────────────────────────────────────────

  async checkLiveness(_imageData: Buffer): Promise<LivenessResult> {
    // ⚠️  STUB — always passes in mock provider.
    // Replace with real ML model (e.g. FaceLivenessDetector from AWS Rekognition)
    return { isLive: true, confidence: 0.97 };
  }

  // ── Anti-spoofing (stub) ──────────────────────────────────────────────────

  async detectSpoofing(_imageData: Buffer): Promise<boolean> {
    // ⚠️  STUB — always returns false (no spoofing detected) in mock provider.
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

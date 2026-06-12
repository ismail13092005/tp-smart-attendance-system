/**
 * AWSRekognitionProvider — PROVIDER-SPECIFIC stub
 *
 * ⚠️  This file is a documented integration skeleton.
 *     It will NOT compile without the AWS SDK installed:
 *       npm install @aws-sdk/client-rekognition
 *
 * To activate:
 *   1. Install the SDK above
 *   2. Set FACE_SERVICE_PROVIDER=aws-rekognition in .env
 *   3. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, FACE_AWS_COLLECTION_ID
 *   4. Uncomment the import and implementation below
 *
 * Architecture notes:
 *  - AWS Rekognition stores face vectors in a "Collection" on their side.
 *    We still store our own encrypted descriptor locally for portability
 *    and to avoid vendor lock-in on the comparison step.
 *  - The externalFaceId returned by IndexFaces is stored in face_enrollments
 *    so we can call DeleteFaces if the user withdraws consent (GDPR).
 *  - Liveness uses the FaceLivenessSession API (separate from IndexFaces).
 */

import type {
  IFaceProvider,
  FaceQualityReport,
  FaceDescriptorResult,
  VerificationResult,
  LivenessResult,
} from '../face.types';
import { FaceError, FaceErrorCode } from '../face.types';

// ── Uncomment when SDK is installed ──────────────────────────────────────────
// import {
//   RekognitionClient,
//   DetectFacesCommand,
//   IndexFacesCommand,
//   CompareFacesCommand,
//   DeleteFacesCommand,
// } from '@aws-sdk/client-rekognition';

export class AWSRekognitionProvider implements IFaceProvider {
  readonly name = 'aws-rekognition';

  // private client: RekognitionClient;
  // private collectionId: string;

  constructor() {
    // ⚠️  PROVIDER-SPECIFIC: Uncomment and configure when SDK is installed
    // this.client = new RekognitionClient({ region: process.env.AWS_REGION });
    // this.collectionId = process.env.FACE_AWS_COLLECTION_ID ?? 'attendance-faces';
    throw new FaceError(
      FaceErrorCode.PROVIDER_UNAVAILABLE,
      'AWS Rekognition provider is not yet configured. See providers/aws-rekognition.provider.ts.',
      false,
    );
  }

  async detectFaceQuality(_imageData: Buffer): Promise<FaceQualityReport> {
    // ⚠️  PROVIDER-SPECIFIC: Use DetectFaces with Attributes=['ALL']
    // Map FaceDetail.Quality.Brightness / Sharpness / Pose to FaceQualityReport
    throw new FaceError(FaceErrorCode.PROVIDER_UNAVAILABLE, 'Not implemented');
  }

  async extractDescriptor(_imageData: Buffer): Promise<FaceDescriptorResult> {
    // ⚠️  PROVIDER-SPECIFIC: Use IndexFaces to add to collection
    // Store the returned FaceId as externalFaceId
    // AWS does not return the raw embedding — use CompareFaces for matching
    throw new FaceError(FaceErrorCode.PROVIDER_UNAVAILABLE, 'Not implemented');
  }

  async compareDescriptors(
    _liveDescriptor: number[],
    _storedDescriptor: number[],
    _threshold: number,
  ): Promise<VerificationResult> {
    // ⚠️  PROVIDER-SPECIFIC: Use CompareFaces with source=live image, target=stored image
    // Note: AWS compares images, not raw vectors — you may need to store the
    // original image reference or use SearchFacesByImage against the collection.
    throw new FaceError(FaceErrorCode.PROVIDER_UNAVAILABLE, 'Not implemented');
  }

  async checkLiveness(_imageData: Buffer): Promise<LivenessResult> {
    // ⚠️  PROVIDER-SPECIFIC: Use CreateFaceLivenessSession + GetFaceLivenessSessionResults
    throw new FaceError(FaceErrorCode.PROVIDER_UNAVAILABLE, 'Not implemented');
  }

  async detectSpoofing(_imageData: Buffer): Promise<boolean> {
    // ⚠️  PROVIDER-SPECIFIC: Bundled into liveness session result
    throw new FaceError(FaceErrorCode.PROVIDER_UNAVAILABLE, 'Not implemented');
  }
}

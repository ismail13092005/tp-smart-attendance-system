/**
 * Face API routes
 *
 * POST /api/face/enroll              — enroll face (student only)
 * POST /api/face/quality-check       — assess frame quality before enrollment
 * GET  /api/face/enrollment-status   — check enrollment status
 * DELETE /api/face/enrollment        — delete enrollment (GDPR)
 *
 * @openapi
 * tags:
 *   - name: Face
 *     description: Biometric face enrollment and verification
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, can } from '../middleware/auth.middleware';
import { Permission } from '../shared/permissions';
import { faceService } from '../modules/face/face.service';
import { FaceError, FaceErrorCode } from '../modules/face/face.types';

const router = Router();

// 5 MB limit — raw webcam frames are typically 50–200 KB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Error → HTTP status mapping ───────────────────────────────────────────────

const FACE_ERROR_STATUS: Record<FaceErrorCode, number> = {
  [FaceErrorCode.NO_FACE_DETECTED]:     422,
  [FaceErrorCode.MULTIPLE_FACES]:       422,
  [FaceErrorCode.BLURRY_FRAME]:         422,
  [FaceErrorCode.LOW_CONFIDENCE]:       422,
  [FaceErrorCode.LIVENESS_FAILED]:      422,
  [FaceErrorCode.SPOOFING_DETECTED]:    422,
  [FaceErrorCode.QUALITY_TOO_LOW]:      422,
  [FaceErrorCode.IMAGE_TOO_SMALL]:      422,
  [FaceErrorCode.INVALID_IMAGE]:        400,
  [FaceErrorCode.ENROLLMENT_NOT_FOUND]: 404,
  [FaceErrorCode.ENCRYPTION_ERROR]:     500,
  [FaceErrorCode.PROVIDER_UNAVAILABLE]: 503,
};

function handleFaceError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof FaceError) {
    const status = FACE_ERROR_STATUS[err.code] ?? 500;
    res.status(status).json({
      success: false,
      error: {
        code:      err.code,
        message:   err.message,
        retryable: err.retryable,
      },
    });
    return;
  }
  next(err);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/face/quality-check:
 *   post:
 *     tags: [Face]
 *     summary: Assess frame quality before enrollment
 *     description: |
 *       Call this before /enroll to give the user real-time feedback.
 *       Returns quality score, issues list, and bounding box.
 *       Does NOT store anything.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               faceImage: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Quality report
 *       422:
 *         description: No face detected or quality too low
 */
router.post(
  '/quality-check',
  authenticate,
  upload.single('faceImage'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'faceImage is required' } });
        return;
      }
      const report = await faceService.detectFaceQuality(req.file.buffer);
      res.json({ success: true, data: { quality: report } });
    } catch (err) {
      handleFaceError(err, res, next);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/face/enroll:
 *   post:
 *     tags: [Face]
 *     summary: Enroll face biometric
 *     description: |
 *       Accepts a single JPEG/PNG frame.
 *       The raw image is processed in memory and immediately discarded.
 *       Only an AES-256 encrypted descriptor is persisted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               faceImage: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Enrollment successful
 *       422:
 *         description: Quality / liveness / spoofing failure
 */
router.post(
  '/enroll',
  authenticate,
  can(Permission.FACE_ENROLL_SELF),
  upload.single('faceImage'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'faceImage is required' } });
        return;
      }

      const result = await faceService.enrollFace(
        req.user!.sub,
        req.file.buffer,
        { ip: req.requestContext.ip, userAgent: req.requestContext.userAgent },
      );

      res.json({
        success: true,
        data: {
          enrollmentId:  result.enrollmentId,
          qualityScore:  result.qualityScore,
          provider:      result.provider,
          expiresAt:     result.expiresAt,
        },
        message: 'Face enrolled successfully',
      });
    } catch (err) {
      handleFaceError(err, res, next);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/face/enrollment-status:
 *   get:
 *     tags: [Face]
 *     summary: Get enrollment status for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment status
 */
router.get(
  '/enrollment-status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await faceService.getEnrollmentStatus(req.user!.sub);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/face/enrollment:
 *   delete:
 *     tags: [Face]
 *     summary: Delete face enrollment (GDPR right-to-erasure)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrollment deleted
 */
router.delete(
  '/enrollment',
  authenticate,
  can(Permission.FACE_DELETE_SELF),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await faceService.deleteEnrollment(
        req.user!.sub,
        { ip: req.requestContext.ip },
      );
      res.json({ success: true, message: 'Face enrollment deleted' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

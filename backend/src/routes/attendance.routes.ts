import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AttendanceService } from '../modules/attendance/attendance.service';
import { authenticate, authorize, can } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { attendanceLimiter } from '../middleware/rate-limit.middleware';
import { UserRole, AttendanceStatus } from '../shared/types';
import { Permission } from '../shared/permissions';
import { ForbiddenError } from '../shared/errors';
import multer from 'multer';

const router = Router();
const attendanceService = new AttendanceService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const markSchema = z.object({
  qrToken:   z.string().min(1),
  latitude:  z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracy:  z.coerce.number().optional(),
  deviceId:  z.string().optional(),
});

const overrideSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status:    z.enum(['present', 'absent', 'late', 'excused']),
  reason:    z.string().min(1),
});

router.post(
  '/mark',
  authenticate,
  can(Permission.ATTENDANCE_MARK_SELF),
  attendanceLimiter,
  upload.single('faceImage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'Face image is required' } });
        return;
      }
      const body = markSchema.parse(req.body);
      const attendance = await attendanceService.markAttendance({
        studentId:     req.user!.sub,
        qrToken:       body.qrToken,
        faceImageData: req.file.buffer,
        location: {
          latitude:  body.latitude,
          longitude: body.longitude,
          accuracy:  body.accuracy,
          timestamp: Date.now(),
        },
        deviceInfo: {
          ip:        req.requestContext.ip,
          userAgent: req.requestContext.userAgent,
          deviceId:  body.deviceId,
        },
      });
      res.json({ success: true, data: { attendance }, message: 'Attendance marked successfully' });
    } catch (err) { next(err); }
  },
);

router.get(
  '/session/:sessionId',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await attendanceService.getSessionAttendance(req.params.sessionId);
      res.json({ success: true, data: { attendance } });
    } catch (err) { next(err); }
  },
);

router.get(
  '/student/:studentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role === UserRole.STUDENT && req.user!.sub !== req.params.studentId) {
        return next(new ForbiddenError());
      }
      const filters: Record<string, unknown> = {};
      if (req.query.startDate)  filters.startDate  = new Date(req.query.startDate as string);
      if (req.query.endDate)    filters.endDate    = new Date(req.query.endDate as string);
      if (req.query.courseCode) filters.courseCode = req.query.courseCode;
      const attendance = await attendanceService.getStudentAttendance(req.params.studentId, filters as any);
      res.json({ success: true, data: { attendance } });
    } catch (err) { next(err); }
  },
);

router.post(
  '/manual-override',
  authenticate,
  can(Permission.ATTENDANCE_OVERRIDE),
  validate(overrideSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await attendanceService.manualOverride({
        sessionId:    req.body.sessionId,
        studentId:    req.body.studentId,
        status:       req.body.status as AttendanceStatus,
        overriddenBy: req.user!.sub,
        reason:       req.body.reason,
      });
      res.json({ success: true, data: { attendance }, message: 'Attendance override successful' });
    } catch (err) { next(err); }
  },
);

// ── Bulk mark — mark multiple students at once (faculty/admin only) ───────────
// Policy: only allowed for sessions that are active or completed.
// Each entry is treated as a manual override with a shared reason.
const bulkMarkSchema = z.object({
  sessionId:  z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1).max(100),
  status:     z.enum(['present', 'absent', 'late', 'excused']),
  reason:     z.string().min(1, 'Reason is required for bulk mark'),
});

router.post(
  '/bulk-mark',
  authenticate,
  can(Permission.ATTENDANCE_OVERRIDE),
  validate(bulkMarkSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, studentIds, status, reason } = req.body as z.infer<typeof bulkMarkSchema>;
      const overriddenBy = req.user!.sub;

      const results = await Promise.allSettled(
        studentIds.map(studentId =>
          attendanceService.manualOverride({
            sessionId,
            studentId,
            status: status as AttendanceStatus,
            overriddenBy,
            reason,
          }),
        ),
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed    = results.filter(r => r.status === 'rejected').length;

      res.json({
        success: true,
        data: { succeeded, failed, total: studentIds.length },
        message: `Bulk mark complete: ${succeeded} updated, ${failed} failed`,
      });
    } catch (err) { next(err); }
  },
);

export default router;

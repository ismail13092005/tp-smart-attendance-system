/**
 * Session routes — use raw SQL to match the actual faculty_sessions schema.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, can } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { UserRole } from '../shared/types';
import { Permission } from '../shared/permissions';
import { NotFoundError, ForbiddenError } from '../shared/errors';
import pool from '../database/pool';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const createSchema = z.object({
  courseCode:         z.string().min(1),
  courseName:         z.string().min(1),
  sessionType:        z.enum(['lecture', 'lab', 'tutorial', 'seminar', 'workshop', 'exam']),
  scheduledStartTime: z.string().min(1),
  scheduledEndTime:   z.string().min(1),
  location:           z.string().min(1),
  latitude:           z.number().min(-90).max(90).optional(),
  longitude:          z.number().min(-180).max(180).optional(),
  geofenceRadius:     z.number().int().min(10).max(1000).optional(),
  expectedStudents:   z.number().int().min(0).optional(),
});

// ── Helper: fetch session with subject info ───────────────────────────────────

async function getSessionById(id: string) {
  const { rows } = await pool.query(`
    SELECT
      fs.id, fs.faculty_user_id, fs.session_type, fs.status,
      fs.scheduled_start, fs.scheduled_end, fs.actual_start, fs.actual_end,
      fs.location_name AS location, fs.geofence_radius_m AS geofence_radius,
      fs.present_count, fs.late_count, fs.absent_count, fs.expected_count,
      fs.notes, fs.created_at,
      -- GPS coordinates extracted from PostGIS geography column
      ST_Y(fs.location_point::geometry) AS latitude,
      ST_X(fs.location_point::geometry) AS longitude,
      -- Pull course info from classes + subjects
      COALESCE(sub.code,  (fs.notes::jsonb->>'courseCode'),  'N/A') AS course_code,
      COALESCE(sub.name,  (fs.notes::jsonb->>'courseName'),  'N/A') AS course_name,
      u.first_name || ' ' || u.last_name   AS faculty_name
    FROM faculty_sessions fs
    LEFT JOIN classes c   ON c.id = fs.class_id
    LEFT JOIN subjects sub ON sub.id = c.subject_id
    JOIN users u ON u.id = fs.faculty_user_id
    WHERE fs.id = $1 AND fs.deleted_at IS NULL
  `, [id]);
  return rows[0] ?? null;
}

// ── POST / — create session ───────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  can(Permission.SESSION_CREATE),
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = uuidv4();
      const {
        courseCode, courseName, sessionType,
        scheduledStartTime, scheduledEndTime,
        location, latitude, longitude,
        geofenceRadius = 100, expectedStudents = 0,
      } = req.body;

      // We store course info in notes as JSON since faculty_sessions
      // links to classes, but we allow ad-hoc sessions without a class
      const notesJson = JSON.stringify({ courseCode, courseName });

      await pool.query(`
        INSERT INTO faculty_sessions
          (id, faculty_user_id, term_id, session_type, status,
           scheduled_start, scheduled_end,
           location_name, location_point, geofence_radius_m,
           expected_count, notes)
        VALUES ($1,$2,
          (SELECT id FROM terms WHERE is_active=TRUE LIMIT 1),
          $3,'scheduled',$4,$5,$6,
          CASE WHEN $7::float IS NOT NULL AND $8::float IS NOT NULL
               THEN ST_SetSRID(ST_MakePoint($7,$8),4326)::geography
               ELSE NULL END,
          $9,$10,$11)
      `, [
        id, req.user!.sub,
        sessionType,
        new Date(scheduledStartTime), new Date(scheduledEndTime),
        location,
        longitude ?? null, latitude ?? null,
        geofenceRadius, expectedStudents, notesJson,
      ]);

      const session = await getSessionById(id);
      res.status(201).json({ success: true, data: { session } });
    } catch (err) { next(err); }
  },
);

// ── POST /:id/start ───────────────────────────────────────────────────────────

router.post(
  '/:id/start',
  authenticate,
  can(Permission.SESSION_START),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, faculty_user_id, status FROM faculty_sessions WHERE id=$1 AND deleted_at IS NULL`,
        [req.params.id],
      );
      if (!rows[0]) throw new NotFoundError('Session not found');
      if (rows[0].faculty_user_id !== req.user!.sub) throw new ForbiddenError();

      // Accept live faculty coordinates if provided, update location_point
      const { latitude, longitude } = req.body;
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        await pool.query(
          `UPDATE faculty_sessions SET status='active', actual_start=NOW(), updated_at=NOW(),
           location_point=ST_SetSRID(ST_MakePoint($2,$3),4326)::geography WHERE id=$1`,
          [req.params.id, longitude, latitude],
        );
      } else {
        await pool.query(
          `UPDATE faculty_sessions SET status='active', actual_start=NOW(), updated_at=NOW() WHERE id=$1`,
          [req.params.id],
        );
      }

      // Generate QR using the existing QR service (it reads from sessions table via Sequelize)
      // We'll return a simple signed token instead
      const qrCode = await generateQRForSession(req.params.id, req.user!.sub);
      const session = await getSessionById(req.params.id);

      res.json({ success: true, data: { session, qrCode } });
    } catch (err) { next(err); }
  },
);

// ── POST /:id/end ─────────────────────────────────────────────────────────────

router.post(
  '/:id/end',
  authenticate,
  can(Permission.SESSION_END),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, faculty_user_id FROM faculty_sessions WHERE id=$1 AND deleted_at IS NULL`,
        [req.params.id],
      );
      if (!rows[0]) throw new NotFoundError('Session not found');
      if (rows[0].faculty_user_id !== req.user!.sub) throw new ForbiddenError();

      await pool.query(
        `UPDATE faculty_sessions SET status='completed', actual_end=NOW(), updated_at=NOW() WHERE id=$1`,
        [req.params.id],
      );

      const session = await getSessionById(req.params.id);
      res.json({ success: true, data: { session } });
    } catch (err) { next(err); }
  },
);

// ── POST /:id/refresh-qr ──────────────────────────────────────────────────────

router.post(
  '/:id/refresh-qr',
  authenticate,
  can(Permission.SESSION_REFRESH_QR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, faculty_user_id FROM faculty_sessions WHERE id=$1 AND deleted_at IS NULL`,
        [req.params.id],
      );
      if (!rows[0]) throw new NotFoundError('Session not found');
      if (rows[0].faculty_user_id !== req.user!.sub) throw new ForbiddenError();

      const qrCode = await generateQRForSession(req.params.id, req.user!.sub);
      res.json({ success: true, data: { qrCode } });
    } catch (err) { next(err); }
  },
);

// ── GET /:id ──────────────────────────────────────────────────────────────────

router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await getSessionById(req.params.id);
      if (!session) throw new NotFoundError('Session not found');
      res.json({ success: true, data: { session } });
    } catch (err) { next(err); }
  },
);

// ── POST /validate-qr — student pre-validates a scanned token ────────────────

router.post(
  '/validate-qr',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, error: { message: 'token is required' } });
        return;
      }

      const { QRService } = await import('../modules/qr/qr.service');
      const qrService = new QRService();
      const result = await qrService.verifyQRToken(token);

      if (!result.valid) {
        res.json({ success: true, data: { valid: false, reason: result.reason } });
        return;
      }

      // Fetch session info to show the student what they're checking into
      const { rows } = await pool.query(`
        SELECT
          fs.id AS "sessionId",
          COALESCE(sub.code,  (fs.notes::jsonb->>'courseCode'),  'N/A') AS "courseCode",
          COALESCE(sub.name,  (fs.notes::jsonb->>'courseName'),  'N/A') AS "courseName",
          u.first_name || ' ' || u.last_name AS "facultyName",
          fs.location_name AS location,
          fs.session_type AS "sessionType",
          fs.geofence_radius_m AS "geofenceRadius",
          ST_Y(fs.location_point::geometry) AS "sessionLatitude",
          ST_X(fs.location_point::geometry) AS "sessionLongitude"
        FROM faculty_sessions fs
        LEFT JOIN classes c    ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        JOIN users u ON u.id = fs.faculty_user_id
        WHERE fs.id = $1 AND fs.deleted_at IS NULL
      `, [result.sessionId]);

      const session = rows[0];
      res.json({
        success: true,
        data: {
          valid: true,
          sessionId:       session?.sessionId ?? result.sessionId,
          courseCode:      session?.courseCode ?? '—',
          courseName:      session?.courseName ?? '—',
          facultyName:     session?.facultyName ?? '—',
          location:        session?.location ?? '—',
          sessionType:     session?.sessionType ?? '—',
          geofenceRadius:  session?.geofenceRadius ?? 100,
          sessionLatitude:  session?.sessionLatitude  ?? null,
          sessionLongitude: session?.sessionLongitude ?? null,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conditions = ['fs.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;

      if (req.user!.role === UserRole.FACULTY) {
        conditions.push(`fs.faculty_user_id = $${p++}`);
        params.push(req.user!.sub);
      }

      const { rows } = await pool.query(`
        SELECT
          fs.id, fs.faculty_user_id, fs.session_type, fs.status,
          fs.scheduled_start, fs.scheduled_end, fs.actual_start,
          fs.location_name AS location, fs.geofence_radius_m AS geofence_radius,
          fs.present_count, fs.late_count, fs.absent_count, fs.expected_count,
          fs.notes, fs.created_at,
          COALESCE(sub.code,  (fs.notes::jsonb->>'courseCode'),  'N/A') AS course_code,
          COALESCE(sub.name,  (fs.notes::jsonb->>'courseName'),  'N/A') AS course_name,
          u.first_name || ' ' || u.last_name AS faculty_name
        FROM faculty_sessions fs
        LEFT JOIN classes c    ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        JOIN users u ON u.id = fs.faculty_user_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY fs.scheduled_start DESC
        LIMIT 50
      `, params);

      res.json({ success: true, data: { sessions: rows } });
    } catch (err) { next(err); }
  },
);

// ── QR generation helper (uses QRService) ─────────────────────────────────────

import { QRService } from '../modules/qr/qr.service';
const qrService = new QRService();

async function generateQRForSession(sessionId: string, facultyId: string) {
  return qrService.generateQRCode(sessionId, facultyId);
}

export default router;

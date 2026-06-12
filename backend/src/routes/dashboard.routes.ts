/**
 * Dashboard analytics routes — all SQL uses the real schema column names.
 * faculty_sessions: id, faculty_user_id, session_type, status,
 *   scheduled_start, scheduled_end, actual_start, actual_end,
 *   location_name, geofence_radius_m, present_count, late_count,
 *   absent_count, expected_count, notes, class_id
 * attendance_records: id, faculty_session_id, student_user_id, status,
 *   marked_at, face_confidence, is_manual_override
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../shared/types';
import pool from '../database/pool';

const router = Router();

// ── Shared session CTE ────────────────────────────────────────────────────────
// Joins faculty_sessions → classes → subjects to get course_code/name

const SESSION_CTE = `
  WITH sessions_with_course AS (
    SELECT
      fs.id, fs.faculty_user_id, fs.session_type, fs.status,
      fs.scheduled_start, fs.scheduled_end, fs.actual_start, fs.actual_end,
      fs.location_name AS location,
      fs.geofence_radius_m AS geofence_radius,
      fs.present_count, fs.late_count, fs.absent_count, fs.expected_count,
      fs.notes, fs.created_at, fs.class_id,
      COALESCE(sub.code, fs.notes::jsonb->>'courseCode', 'N/A') AS course_code,
      COALESCE(sub.name, fs.notes::jsonb->>'courseName', 'N/A') AS course_name,
      u.first_name || ' ' || u.last_name AS faculty_name
    FROM faculty_sessions fs
    LEFT JOIN classes c    ON c.id = fs.class_id
    LEFT JOIN subjects sub ON sub.id = c.subject_id
    JOIN users u ON u.id = fs.faculty_user_id
    WHERE fs.deleted_at IS NULL
  )
`;

// ── Student attendance history (date-wise, filterable) ───────────────────────

router.get(
  '/student/:studentId/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      if (req.user!.role === UserRole.STUDENT && req.user!.sub !== studentId) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } });
        return;
      }

      const { startDate, endDate, courseCode } = req.query;
      const conditions: string[] = ['ar.student_user_id = $1', 'ar.deleted_at IS NULL'];
      const params: unknown[] = [studentId];
      let p = 2;

      if (startDate)  { conditions.push(`fs.scheduled_start >= $${p++}`); params.push(startDate); }
      if (endDate)    { conditions.push(`fs.scheduled_start <= $${p++}`); params.push(endDate); }
      if (courseCode) { conditions.push(`COALESCE(sub.code,'N/A') = $${p++}`); params.push(courseCode); }

      const { rows } = await pool.query(`
        SELECT
          ar.id,
          ar.status,
          ar.marked_at,
          ar.face_confidence,
          ar.is_manual_override,
          fs.scheduled_start,
          fs.scheduled_end,
          fs.location_name AS location,
          fs.session_type,
          COALESCE(sub.code, 'N/A')  AS course_code,
          COALESCE(sub.name, 'N/A')  AS course_name,
          u.first_name || ' ' || u.last_name AS faculty_name
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        LEFT JOIN classes c    ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        JOIN users u ON u.id = fs.faculty_user_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY fs.scheduled_start DESC
        LIMIT 200
      `, params);

      // Also return distinct subjects for filter dropdown
      const subjectsQ = await pool.query(`
        SELECT DISTINCT
          COALESCE(sub.code, 'N/A') AS course_code,
          COALESCE(sub.name, 'N/A') AS course_name
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        LEFT JOIN classes c    ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        WHERE ar.student_user_id = $1 AND ar.deleted_at IS NULL
        ORDER BY course_name
      `, [studentId]);

      res.json({
        success: true,
        data: { records: rows, subjects: subjectsQ.rows },
      });
    } catch (err) { next(err); }
  },
);

// ── Student dashboard ─────────────────────────────────────────────────────────

router.get(
  '/student/:studentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      if (req.user!.role === UserRole.STUDENT && req.user!.sub !== studentId) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } });
        return;
      }

      // Overall summary
      const summaryQ = await pool.query(`
        SELECT
          COUNT(*)                                                      AS total,
          COUNT(*) FILTER (WHERE status IN ('present','late'))          AS attended,
          ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('present','late'))
            / NULLIF(COUNT(*),0), 1)                                   AS overall_pct
        FROM attendance_records
        WHERE student_user_id = $1 AND deleted_at IS NULL
      `, [studentId]);

      // Per-subject breakdown
      const subjectQ = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.course_code,
          swc.course_name,
          COUNT(ar.id)                                                  AS total_classes,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM sessions_with_course swc
        LEFT JOIN attendance_records ar
          ON ar.faculty_session_id = swc.id
          AND ar.student_user_id = $1
          AND ar.deleted_at IS NULL
        GROUP BY swc.course_code, swc.course_name
        ORDER BY swc.course_name
      `, [studentId]);

      // Today's sessions — only show active ones that haven't ended yet
      const todayQ = await pool.query(`
        ${SESSION_CTE}
        SELECT id, course_code, course_name, session_type, status,
               scheduled_start, scheduled_end, location, faculty_name
        FROM sessions_with_course
        WHERE DATE(scheduled_start AT TIME ZONE 'UTC') = CURRENT_DATE
          AND status = 'active'
          AND scheduled_end > NOW()
        ORDER BY scheduled_start
      `);

      // Notifications
      const notifQ = await pool.query(`
        SELECT id, type, title, body, status, created_at
        FROM notifications
        WHERE recipient_id = $1
        ORDER BY created_at DESC LIMIT 10
      `, [studentId]);

      res.json({
        success: true,
        data: {
          summary:       summaryQ.rows[0],
          subjects:      subjectQ.rows,
          todaySessions: todayQ.rows,
          notifications: notifQ.rows,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Faculty: session attendance sheet (students + status) ────────────────────

router.get(
  '/faculty/:facultyId/session/:sessionId/sheet',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, sessionId } = req.params;

      // Verify ownership
      const { rows: sess } = await pool.query(
        `SELECT id, faculty_user_id FROM faculty_sessions WHERE id=$1 AND deleted_at IS NULL`,
        [sessionId],
      );
      if (!sess[0]) { res.status(404).json({ success: false, error: { message: 'Session not found' } }); return; }
      if (sess[0].faculty_user_id !== facultyId && req.user!.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } }); return;
      }

      const { rows } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          u.id                                          AS student_id,
          u.first_name,
          u.last_name,
          u.email,
          sp.student_id                                 AS roll_number,
          ar.id                                         AS record_id,
          ar.status,
          ar.marked_at,
          ar.face_confidence,
          ar.qr_verified,
          ar.face_verified,
          ar.geo_verified,
          ar.is_manual_override,
          ar.override_reason,
          swc.course_code,
          swc.course_name,
          swc.session_type,
          swc.scheduled_start,
          swc.scheduled_end,
          swc.location
        FROM sessions_with_course swc
        -- Students who marked attendance (always shown)
        JOIN attendance_records ar
          ON ar.faculty_session_id = swc.id
          AND ar.deleted_at IS NULL
        JOIN users u ON u.id = ar.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE swc.id = $1

        UNION

        -- Enrolled students who haven't marked yet (only for class-linked sessions)
        SELECT
          u.id                                          AS student_id,
          u.first_name,
          u.last_name,
          u.email,
          sp.student_id                                 AS roll_number,
          NULL                                          AS record_id,
          NULL                                          AS status,
          NULL                                          AS marked_at,
          NULL                                          AS face_confidence,
          FALSE                                         AS qr_verified,
          FALSE                                         AS face_verified,
          FALSE                                         AS geo_verified,
          FALSE                                         AS is_manual_override,
          NULL                                          AS override_reason,
          swc.course_code,
          swc.course_name,
          swc.session_type,
          swc.scheduled_start,
          swc.scheduled_end,
          swc.location
        FROM sessions_with_course swc
        JOIN enrollments e ON e.class_id = swc.class_id AND e.status = 'enrolled' AND e.deleted_at IS NULL
        JOIN users u ON u.id = e.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE swc.id = $1
          AND swc.class_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM attendance_records ar2
            WHERE ar2.faculty_session_id = swc.id
              AND ar2.student_user_id = u.id
              AND ar2.deleted_at IS NULL
          )

        ORDER BY last_name, first_name
      `, [sessionId]);

      res.json({ success: true, data: { sheet: rows } });
    } catch (err) { next(err); }
  },
);

// ── Faculty: defaulters with threshold filter ─────────────────────────────────

router.get(
  '/faculty/:facultyId/defaulters',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId } = req.params;
      const threshold = parseInt(req.query.threshold as string ?? '75', 10);
      const courseCode = req.query.courseCode as string | undefined;

      const conditions = [`swc.faculty_user_id = $1`];
      const params: unknown[] = [facultyId, threshold];
      let p = 3;
      if (courseCode) { conditions.push(`swc.course_code = $${p++}`); params.push(courseCode); }

      const { rows } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          sp.student_id AS roll_number,
          swc.course_code, swc.course_name,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent')              AS absent,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM sessions_with_course swc
        JOIN attendance_records ar ON ar.faculty_session_id = swc.id AND ar.deleted_at IS NULL
        JOIN users u ON u.id = ar.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY u.id, u.first_name, u.last_name, u.email, sp.student_id,
                 swc.course_code, swc.course_name
        HAVING ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
          / NULLIF(COUNT(ar.id),0), 1) < $2
        ORDER BY pct ASC
        LIMIT 200
      `, params);

      // Distinct courses for filter dropdown
      const coursesQ = await pool.query(`
        ${SESSION_CTE}
        SELECT DISTINCT course_code, course_name
        FROM sessions_with_course
        WHERE faculty_user_id = $1
        ORDER BY course_name
      `, [facultyId]);

      res.json({ success: true, data: { defaulters: rows, courses: coursesQ.rows } });
    } catch (err) { next(err); }
  },
);

// ── Faculty: reports (lecture-wise + summary) ─────────────────────────────────

router.get(
  '/faculty/:facultyId/reports',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId } = req.params;
      const { startDate, endDate, courseCode } = req.query;

      const conditions = [`swc.faculty_user_id = $1`];
      const params: unknown[] = [facultyId];
      let p = 2;
      if (startDate)  { conditions.push(`swc.scheduled_start >= $${p++}`); params.push(startDate); }
      if (endDate)    { conditions.push(`swc.scheduled_start <= $${p++}`); params.push(endDate); }
      if (courseCode) { conditions.push(`swc.course_code = $${p++}`);      params.push(courseCode); }

      // Lecture-wise breakdown
      const lectureQ = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.id AS session_id,
          swc.course_code,
          swc.course_name,
          swc.session_type,
          swc.scheduled_start,
          swc.scheduled_end,
          swc.location,
          swc.expected_count,
          swc.present_count,
          swc.late_count,
          swc.absent_count,
          swc.status,
          ROUND(100.0 * swc.present_count / NULLIF(swc.expected_count, 0), 1) AS attendance_pct
        FROM sessions_with_course swc
        WHERE ${conditions.join(' AND ')}
        ORDER BY swc.scheduled_start DESC
        LIMIT 200
      `, params);

      // Subject-level summary
      const summaryQ = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.course_code,
          swc.course_name,
          COUNT(swc.id)                                                 AS total_sessions,
          SUM(swc.expected_count)                                       AS total_expected,
          SUM(swc.present_count)                                        AS total_present,
          SUM(swc.late_count)                                           AS total_late,
          SUM(swc.absent_count)                                         AS total_absent,
          ROUND(100.0 * SUM(swc.present_count) / NULLIF(SUM(swc.expected_count), 0), 1) AS avg_pct
        FROM sessions_with_course swc
        WHERE ${conditions.join(' AND ')}
        GROUP BY swc.course_code, swc.course_name
        ORDER BY swc.course_name
      `, params);

      // Courses for filter
      const coursesQ = await pool.query(`
        ${SESSION_CTE}
        SELECT DISTINCT course_code, course_name
        FROM sessions_with_course WHERE faculty_user_id = $1
        ORDER BY course_name
      `, [facultyId]);

      res.json({
        success: true,
        data: {
          lectures: lectureQ.rows,
          summary:  summaryQ.rows,
          courses:  coursesQ.rows,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Faculty dashboard ─────────────────────────────────────────────────────────

router.get(
  '/faculty/:facultyId',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId } = req.params;

      // Today's sessions
      const todayQ = await pool.query(`
        ${SESSION_CTE}
        SELECT id, course_code, course_name, session_type, status,
               scheduled_start, scheduled_end, location,
               present_count, late_count, absent_count, expected_count
        FROM sessions_with_course
        WHERE faculty_user_id = $1
          AND DATE(scheduled_start AT TIME ZONE 'UTC') = CURRENT_DATE
        ORDER BY scheduled_start
      `, [facultyId]);

      // Recent sessions (last 30 days)
      const recentQ = await pool.query(`
        ${SESSION_CTE}
        SELECT id, course_code, course_name, status,
               scheduled_start, present_count, late_count, absent_count, expected_count
        FROM sessions_with_course
        WHERE faculty_user_id = $1
          AND scheduled_start >= NOW() - INTERVAL '30 days'
        ORDER BY scheduled_start DESC LIMIT 20
      `, [facultyId]);

      // Defaulters (< 75%)
      const defaultersQ = await pool.query(`
        ${SESSION_CTE}
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          swc.course_code, swc.course_name,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM sessions_with_course swc
        JOIN attendance_records ar ON ar.faculty_session_id = swc.id AND ar.deleted_at IS NULL
        JOIN users u ON u.id = ar.student_user_id
        WHERE swc.faculty_user_id = $1
        GROUP BY u.id, u.first_name, u.last_name, u.email, swc.course_code, swc.course_name
        HAVING ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
          / NULLIF(COUNT(ar.id),0), 1) < 75
        ORDER BY pct ASC LIMIT 50
      `, [facultyId]);

      res.json({
        success: true,
        data: {
          todaySessions:  todayQ.rows,
          recentSessions: recentQ.rows,
          defaulters:     defaultersQ.rows,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Admin: daily attendance trend (last N days) ───────────────────────────────

router.get(
  '/admin/trend',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = Math.min(parseInt(req.query.days as string ?? '30', 10), 90);
      const { rows } = await pool.query(`
        SELECT
          DATE(fs.scheduled_start AT TIME ZONE 'UTC')                  AS date,
          COUNT(DISTINCT fs.id)                                         AS sessions,
          COALESCE(SUM(fs.expected_count), 0)                          AS expected,
          COALESCE(SUM(fs.present_count + fs.late_count), 0)           AS attended,
          ROUND(100.0 * COALESCE(SUM(fs.present_count + fs.late_count), 0)
            / NULLIF(SUM(fs.expected_count), 0), 1)                    AS pct
        FROM faculty_sessions fs
        WHERE fs.scheduled_start >= NOW() - ($1 || ' days')::INTERVAL
          AND fs.deleted_at IS NULL
          AND fs.status IN ('active','completed')
        GROUP BY DATE(fs.scheduled_start AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `, [days]);
      res.json({ success: true, data: { trend: rows } });
    } catch (err) { next(err); }
  },
);

// ── Admin: today's overview ───────────────────────────────────────────────────

router.get(
  '/admin/today',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(DISTINCT fs.id)                                         AS total_sessions,
          COUNT(DISTINCT fs.id) FILTER (WHERE fs.status = 'active')    AS active_sessions,
          COUNT(DISTINCT fs.id) FILTER (WHERE fs.status = 'completed') AS completed_sessions,
          COALESCE(SUM(fs.expected_count), 0)                          AS total_expected,
          COALESCE(SUM(fs.present_count + fs.late_count), 0)           AS total_present,
          COALESCE(SUM(fs.absent_count), 0)                            AS total_absent,
          ROUND(100.0 * COALESCE(SUM(fs.present_count + fs.late_count), 0)
            / NULLIF(SUM(fs.expected_count), 0), 1)                    AS today_pct
        FROM faculty_sessions fs
        WHERE DATE(fs.scheduled_start AT TIME ZONE 'UTC') = CURRENT_DATE
          AND fs.deleted_at IS NULL
      `);
      res.json({ success: true, data: { today: rows[0] } });
    } catch (err) { next(err); }
  },
);

// ── Admin: faculty monitoring with filters ────────────────────────────────────

router.get(
  '/admin/faculty-monitoring',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, departmentId, page = '1', limit = '20' } = req.query;
      const pageNum  = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const offset   = (pageNum - 1) * limitNum;

      // Build WHERE conditions and params array together so $N is always correct
      const conditions: string[] = ["u.role = 'faculty'", 'u.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;

      if (departmentId) {
        conditions.push(`fp.department_id = $${p++}`);
        params.push(departmentId);
      }

      // Date filter on the JOIN — build placeholder numbers before pushing values
      let dateFilter = '';
      if (startDate) {
        const p1 = p++; const p2 = p++;
        dateFilter = `AND fs.scheduled_start >= $${p1} AND fs.scheduled_start <= $${p2}`;
        params.push(startDate, endDate ?? new Date().toISOString());
      }

      // LIMIT / OFFSET as proper parameters
      const pLimit = p++; const pOffset = p++;
      params.push(limitNum, offset);

      const { rows } = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email, u.last_login_at,
          d.name AS department,
          COUNT(fs.id)                                                  AS sessions_total,
          COUNT(fs.id) FILTER (WHERE fs.status = 'completed')          AS sessions_completed,
          COUNT(fs.id) FILTER (WHERE fs.status = 'active')             AS sessions_active,
          COALESCE(SUM(fs.expected_count), 0)                          AS total_expected,
          COALESCE(SUM(fs.present_count + fs.late_count), 0)           AS total_present,
          ROUND(100.0 * COALESCE(SUM(fs.present_count + fs.late_count), 0)
            / NULLIF(SUM(fs.expected_count), 0), 1)                    AS avg_attendance_pct,
          MAX(fs.scheduled_start)                                       AS last_session_at
        FROM users u
        LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
        LEFT JOIN departments d ON d.id = fp.department_id
        LEFT JOIN faculty_sessions fs ON fs.faculty_user_id = u.id
          AND fs.deleted_at IS NULL ${dateFilter}
        WHERE ${conditions.join(' AND ')}
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.last_login_at, d.name
        ORDER BY sessions_total DESC
        LIMIT $${pLimit} OFFSET $${pOffset}
      `, params);

      // Count uses its own isolated params
      const countConds: string[] = ["u.role = 'faculty'", 'u.deleted_at IS NULL'];
      const countParams: unknown[] = [];
      let cp = 1;
      if (departmentId) { countConds.push(`fp.department_id = $${cp++}`); countParams.push(departmentId); }

      const countQ = await pool.query(
        `SELECT COUNT(*) FROM users u
         LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
         WHERE ${countConds.join(' AND ')}`,
        countParams,
      );

      const deptQ = await pool.query(
        `SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name`,
      );

      res.json({
        success: true,
        data: {
          faculty: rows,
          total: parseInt(countQ.rows[0].count, 10),
          departments: deptQ.rows,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Admin: reports (daily/weekly/monthly/defaulters) ─────────────────────────

router.get(
  '/admin/reports',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = 'daily', startDate, endDate, departmentId } = req.query;

      // Period grouping — whitelist to prevent injection
      const groupExpr =
        period === 'weekly'  ? `DATE_TRUNC('week',  fs.scheduled_start AT TIME ZONE 'UTC')` :
        period === 'monthly' ? `DATE_TRUNC('month', fs.scheduled_start AT TIME ZONE 'UTC')` :
                               `DATE(fs.scheduled_start AT TIME ZONE 'UTC')`;

      const dateConditions: string[] = ['ar.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;
      if (startDate)    { dateConditions.push(`fs.scheduled_start >= $${p++}`); params.push(startDate); }
      if (endDate)      { dateConditions.push(`fs.scheduled_start <= $${p++}`); params.push(endDate); }

      // Department filter — must come AFTER date params so $N is correct
      const deptJoin      = departmentId ? `JOIN student_profiles sp2 ON sp2.user_id = ar.student_user_id` : '';
      const deptCondition = departmentId ? `AND sp2.department_id = $${p++}` : '';
      if (departmentId) { params.push(departmentId); }

      const trendQ = await pool.query(`
        SELECT
          ${groupExpr}                                                  AS period,
          COUNT(DISTINCT fs.id)                                         AS sessions,
          COUNT(ar.id)                                                  AS total_records,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent')              AS absent,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        ${deptJoin}
        WHERE ${dateConditions.join(' AND ')} ${deptCondition}
        GROUP BY ${groupExpr}
        ORDER BY period DESC
        LIMIT 60
      `, params);

      // Defaulters
      const defaultersQ = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          sp.student_id AS roll_number,
          d.name AS department,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM attendance_records ar
        JOIN users u ON u.id = ar.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN departments d ON d.id = sp.department_id
        WHERE ar.deleted_at IS NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email, sp.student_id, d.name
        HAVING ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
          / NULLIF(COUNT(ar.id), 0), 1) < 75
        ORDER BY pct ASC
        LIMIT 200
      `);

      const deptQ = await pool.query(
        `SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name`,
      );

      res.json({
        success: true,
        data: { trend: trendQ.rows, defaulters: defaultersQ.rows, departments: deptQ.rows },
      });
    } catch (err) { next(err); }
  },
);

// ── Admin: global search ──────────────────────────────────────────────────────

router.get(
  '/admin/search',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q = '', role, page = '1', limit = '20' } = req.query;
      const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

      const conditions: string[] = ['u.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;

      if (q) {
        conditions.push(`(
          u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR
          u.email ILIKE $${p} OR
          sp.student_id ILIKE $${p} OR fp.faculty_id ILIKE $${p}
        )`);
        params.push(`%${q}%`);
        p++;
      }
      if (role) { conditions.push(`u.role = $${p++}`); params.push(role); }

      const pLimitN = p++;
      const pOffsetN = p++;
      const { rows } = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email, u.role, u.status,
          u.last_login_at, u.created_at,
          sp.student_id AS roll_number,
          fp.faculty_id,
          d.name AS department,
          -- Attendance summary
          COUNT(ar.id)                                                  AS total_classes,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS attendance_pct
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
        LEFT JOIN departments d ON d.id = COALESCE(sp.department_id, fp.department_id)
        LEFT JOIN attendance_records ar ON ar.student_user_id = u.id AND ar.deleted_at IS NULL
        WHERE ${conditions.join(' AND ')}
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.status,
                 u.last_login_at, u.created_at, sp.student_id, fp.faculty_id, d.name
        ORDER BY u.last_name, u.first_name
        LIMIT $${pLimitN} OFFSET $${pOffsetN}
      `, [...params, parseInt(limit as string, 10), offset]);

      const countQ = await pool.query(`
        SELECT COUNT(*) FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN faculty_profiles fp ON fp.user_id = u.id
        WHERE ${conditions.join(' AND ')}
      `, params);

      res.json({
        success: true,
        data: {
          users: rows,
          total: parseInt(countQ.rows[0].count, 10),
          page: parseInt(page as string, 10),
          limit: parseInt(limit as string, 10),
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Admin dashboard ───────────────────────────────────────────────────────────

router.get(
  '/admin',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const overviewQ = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE role='student' AND deleted_at IS NULL)  AS total_students,
          (SELECT COUNT(*) FROM users WHERE role='faculty' AND deleted_at IS NULL)  AS total_faculty,
          (SELECT COUNT(*) FROM faculty_sessions WHERE status='active' AND deleted_at IS NULL) AS active_sessions,
          (SELECT ROUND(AVG(pct),1) FROM (
            SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('present','late'))
              / NULLIF(COUNT(*),0), 1) AS pct
            FROM attendance_records WHERE deleted_at IS NULL
            GROUP BY faculty_session_id
          ) sub) AS avg_attendance_pct
      `);

      const deptQ = await pool.query(`
        SELECT
          d.name AS department,
          COUNT(DISTINCT u.id)                                          AS students,
          COUNT(ar.id)                                                  AS total_records,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM departments d
        LEFT JOIN student_profiles sp ON sp.department_id = d.id
        LEFT JOIN users u ON u.id = sp.user_id AND u.deleted_at IS NULL
        LEFT JOIN attendance_records ar ON ar.student_user_id = u.id AND ar.deleted_at IS NULL
        WHERE d.deleted_at IS NULL
        GROUP BY d.id, d.name ORDER BY d.name
      `);

      const activeQ = await pool.query(`
        SELECT fs.id, fs.location_name AS location,
               fs.present_count, fs.expected_count,
               COALESCE(sub.code,'N/A') AS course_code,
               COALESCE(sub.name,'N/A') AS course_name,
               u.first_name || ' ' || u.last_name AS faculty_name
        FROM faculty_sessions fs
        LEFT JOIN classes c ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        JOIN users u ON u.id = fs.faculty_user_id
        WHERE fs.status = 'active' AND fs.deleted_at IS NULL
        ORDER BY fs.actual_start DESC
      `);

      const facultyQ = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name,
          COUNT(fs.id) AS sessions_conducted,
          COALESCE(SUM(fs.present_count),0) AS total_present
        FROM users u
        LEFT JOIN faculty_sessions fs ON fs.faculty_user_id = u.id
          AND fs.status = 'completed'
          AND fs.scheduled_start >= DATE_TRUNC('month', NOW())
          AND fs.deleted_at IS NULL
        WHERE u.role = 'faculty' AND u.deleted_at IS NULL
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY sessions_conducted DESC LIMIT 20
      `);

      res.json({
        success: true,
        data: {
          overview:        overviewQ.rows[0],
          departments:     deptQ.rows,
          activeSessions:  activeQ.rows,
          facultyActivity: facultyQ.rows,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Parent: child subject breakdown ──────────────────────────────────────────

router.get(
  '/parent/:parentId/child/:childId/subjects',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentId, childId } = req.params;

      // Strict permission: parent must own this link
      if (req.user!.role === UserRole.PARENT) {
        if (req.user!.sub !== parentId) {
          res.status(403).json({ success: false, error: { message: 'Forbidden' } }); return;
        }
        const { rows: link } = await pool.query(
          `SELECT 1 FROM parent_student_links
           WHERE parent_user_id=$1 AND student_user_id=$2 AND is_approved=TRUE AND deleted_at IS NULL`,
          [parentId, childId],
        );
        if (!link.length) {
          res.status(403).json({ success: false, error: { message: 'Not linked to this student' } }); return;
        }
      }

      const { rows: subjects } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.course_code,
          swc.course_name,
          COUNT(ar.id)                                                  AS total_classes,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent')              AS absent,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM sessions_with_course swc
        LEFT JOIN attendance_records ar
          ON ar.faculty_session_id = swc.id
          AND ar.student_user_id = $1
          AND ar.deleted_at IS NULL
        GROUP BY swc.course_code, swc.course_name
        ORDER BY swc.course_name
      `, [childId]);

      // Monthly breakdown (last 6 months)
      const { rows: monthly } = await pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', fs.scheduled_start), 'Mon YYYY') AS month,
          DATE_TRUNC('month', fs.scheduled_start)                       AS month_date,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        WHERE ar.student_user_id = $1
          AND ar.deleted_at IS NULL
          AND fs.scheduled_start >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', fs.scheduled_start)
        ORDER BY month_date ASC
      `, [childId]);

      res.json({ success: true, data: { subjects, monthly } });
    } catch (err) { next(err); }
  },
);

// ── Parent: child today status + recent attendance with location ──────────────

router.get(
  '/parent/:parentId/child/:childId/today',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentId, childId } = req.params;

      if (req.user!.role === UserRole.PARENT) {
        if (req.user!.sub !== parentId) {
          res.status(403).json({ success: false, error: { message: 'Forbidden' } }); return;
        }
        const { rows: link } = await pool.query(
          `SELECT 1 FROM parent_student_links
           WHERE parent_user_id=$1 AND student_user_id=$2 AND is_approved=TRUE AND deleted_at IS NULL`,
          [parentId, childId],
        );
        if (!link.length) {
          res.status(403).json({ success: false, error: { message: 'Not linked to this student' } }); return;
        }
      }

      // Today's sessions and attendance status
      const { rows: todayRows } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.id AS session_id,
          swc.course_code,
          swc.course_name,
          swc.session_type,
          swc.status AS session_status,
          swc.scheduled_start,
          swc.scheduled_end,
          swc.location,
          swc.faculty_name,
          ar.id AS record_id,
          ar.status AS attendance_status,
          ar.marked_at,
          ar.face_confidence,
          ar.is_manual_override,
          -- Location: only campus-level (building name), never exact coordinates
          swc.location AS campus_location
        FROM sessions_with_course swc
        LEFT JOIN attendance_records ar
          ON ar.faculty_session_id = swc.id
          AND ar.student_user_id = $1
          AND ar.deleted_at IS NULL
        WHERE DATE(swc.scheduled_start AT TIME ZONE 'UTC') = CURRENT_DATE
        ORDER BY swc.scheduled_start
      `, [childId]);

      // Recent attendance with location (last 10 records, campus-level only)
      const { rows: recentRows } = await pool.query(`
        SELECT
          ar.id,
          ar.status,
          ar.marked_at,
          ar.face_confidence,
          ar.is_manual_override,
          fs.scheduled_start,
          fs.scheduled_end,
          fs.location_name AS campus_location,
          fs.session_type,
          COALESCE(sub.code, 'N/A') AS course_code,
          COALESCE(sub.name, 'N/A') AS course_name,
          u.first_name || ' ' || u.last_name AS faculty_name
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        LEFT JOIN classes c ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        JOIN users u ON u.id = fs.faculty_user_id
        WHERE ar.student_user_id = $1 AND ar.deleted_at IS NULL
        ORDER BY ar.marked_at DESC
        LIMIT 10
      `, [childId]);

      res.json({ success: true, data: { today: todayRows, recent: recentRows } });
    } catch (err) { next(err); }
  },
);

// ── Parent dashboard ──────────────────────────────────────────────────────────

router.get(
  '/parent/:parentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentId } = req.params;
      if (req.user!.role === UserRole.PARENT && req.user!.sub !== parentId) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } });
        return;
      }

      const childrenQ = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          sp.student_id, sp.program, sp.current_semester,
          COUNT(ar.id)                                                  AS total_classes,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS overall_pct
        FROM parent_student_links psl
        JOIN users u ON u.id = psl.student_user_id
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN attendance_records ar ON ar.student_user_id = u.id AND ar.deleted_at IS NULL
        WHERE psl.parent_user_id = $1
          AND psl.is_approved = TRUE AND psl.deleted_at IS NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email,
                 sp.student_id, sp.program, sp.current_semester
      `, [parentId]);

      const notifQ = await pool.query(`
        SELECT id, type, title, body, status, created_at
        FROM notifications WHERE recipient_id = $1
        ORDER BY created_at DESC LIMIT 20
      `, [parentId]);

      res.json({
        success: true,
        data: { children: childrenQ.rows, notifications: notifQ.rows },
      });
    } catch (err) { next(err); }
  },
);

// ── Attendance report ─────────────────────────────────────────────────────────

router.get(
  '/attendance-report',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, courseCode, startDate, endDate } = req.query;
      const conditions: string[] = ['ar.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;

      if (sessionId)  { conditions.push(`ar.faculty_session_id = $${p++}`); params.push(sessionId); }
      if (startDate)  { conditions.push(`fs.scheduled_start >= $${p++}`);   params.push(startDate); }
      if (endDate)    { conditions.push(`fs.scheduled_start <= $${p++}`);   params.push(endDate); }
      if (courseCode) { conditions.push(`sub.code = $${p++}`);              params.push(courseCode); }

      const { rows } = await pool.query(`
        SELECT
          u.first_name || ' ' || u.last_name AS student_name,
          u.email,
          COALESCE(sub.code,'N/A') AS course_code,
          COALESCE(sub.name,'N/A') AS course_name,
          fs.scheduled_start,
          ar.status, ar.marked_at, ar.is_manual_override, ar.face_confidence
        FROM attendance_records ar
        JOIN users u ON u.id = ar.student_user_id
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        LEFT JOIN classes c ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY fs.scheduled_start DESC, u.last_name
        LIMIT 500
      `, params);

      res.json({ success: true, data: { records: rows } });
    } catch (err) { next(err); }
  },
);

// ── Faculty: live session attendance (polling endpoint) ───────────────────────
// Used by the faculty QR display page to show real-time present count.
// RBAC: faculty (own sessions only) or admin.

router.get(
  '/faculty/:facultyId/session/:sessionId/live',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, sessionId } = req.params;

      // Ownership check
      const { rows: sess } = await pool.query(
        `SELECT id, faculty_user_id, status, present_count, late_count, absent_count, expected_count
         FROM faculty_sessions WHERE id = $1 AND deleted_at IS NULL`,
        [sessionId],
      );
      if (!sess[0]) { res.status(404).json({ success: false, error: { message: 'Session not found' } }); return; }
      if (sess[0].faculty_user_id !== facultyId && req.user!.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } }); return;
      }

      // Live attendance list — only marked students
      const { rows: records } = await pool.query(`
        SELECT
          u.id AS student_id,
          u.first_name, u.last_name,
          sp.student_id AS roll_number,
          ar.status,
          ar.marked_at,
          ar.face_confidence,
          ar.qr_verified,
          ar.face_verified,
          ar.geo_verified,
          ar.is_manual_override
        FROM attendance_records ar
        JOIN users u ON u.id = ar.student_user_id
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE ar.faculty_session_id = $1 AND ar.deleted_at IS NULL
        ORDER BY ar.marked_at DESC
      `, [sessionId]);

      res.json({
        success: true,
        data: {
          session: {
            id:             sess[0].id,
            status:         sess[0].status,
            present_count:  sess[0].present_count,
            late_count:     sess[0].late_count,
            absent_count:   sess[0].absent_count,
            expected_count: sess[0].expected_count,
          },
          records,
          total_marked: records.length,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Notifications: mark as read ───────────────────────────────────────────────
// RBAC: any authenticated user (own notifications only).

router.post(
  '/notifications/mark-read',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const { ids } = req.body as { ids?: string[] };

      if (ids && ids.length > 0) {
        // Mark specific notifications
        await pool.query(
          `UPDATE notifications
           SET status = 'read', updated_at = NOW()
           WHERE id = ANY($1::uuid[]) AND recipient_id = $2`,
          [ids, userId],
        );
      } else {
        // Mark all unread
        await pool.query(
          `UPDATE notifications
           SET status = 'read', updated_at = NOW()
           WHERE recipient_id = $1 AND status != 'read'`,
          [userId],
        );
      }

      res.json({ success: true, message: 'Notifications marked as read' });
    } catch (err) { next(err); }
  },
);

// ── Admin: branch data — class-level breakdown ────────────────────────────────
// Returns department + class-level attendance for the Branch Data page.
// RBAC: admin only.

router.get(
  '/admin/branch-data',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, termId } = req.query;

      // Department-level summary
      const deptParams: unknown[] = [];
      let dp = 1;
      const deptWhere = ['d.deleted_at IS NULL'];
      if (departmentId) { deptWhere.push(`d.id = $${dp++}`); deptParams.push(departmentId); }

      const { rows: depts } = await pool.query(`
        SELECT
          d.id AS department_id,
          d.name AS department,
          COUNT(DISTINCT sp.user_id)                                    AS students,
          COUNT(ar.id)                                                  AS total_records,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM departments d
        LEFT JOIN student_profiles sp ON sp.department_id = d.id
        LEFT JOIN users u ON u.id = sp.user_id AND u.deleted_at IS NULL
        LEFT JOIN attendance_records ar ON ar.student_user_id = u.id AND ar.deleted_at IS NULL
        WHERE ${deptWhere.join(' AND ')}
        GROUP BY d.id, d.name
        ORDER BY d.name
      `, deptParams);

      // Class-level breakdown
      const classParams: unknown[] = [];
      let cp = 1;
      const classWhere = ['c.deleted_at IS NULL', 'fs.deleted_at IS NULL'];
      if (departmentId) { classWhere.push(`sub.department_id = $${cp++}`); classParams.push(departmentId); }
      if (termId)       { classWhere.push(`c.term_id = $${cp++}`);         classParams.push(termId); }

      const { rows: classes } = await pool.query(`
        SELECT
          c.id AS class_id,
          sub.code AS course_code,
          sub.name AS course_name,
          d.name AS department,
          COUNT(DISTINCT e.student_user_id)                             AS enrolled,
          COUNT(DISTINCT fs.id)                                         AS sessions,
          COALESCE(SUM(fs.present_count + fs.late_count), 0)           AS total_present,
          COALESCE(SUM(fs.expected_count), 0)                          AS total_expected,
          ROUND(100.0 * COALESCE(SUM(fs.present_count + fs.late_count), 0)
            / NULLIF(SUM(fs.expected_count), 0), 1)                    AS avg_pct
        FROM classes c
        JOIN subjects sub ON sub.id = c.subject_id
        LEFT JOIN departments d ON d.id = sub.department_id
        LEFT JOIN enrollments e ON e.class_id = c.id AND e.status = 'enrolled' AND e.deleted_at IS NULL
        LEFT JOIN faculty_sessions fs ON fs.class_id = c.id AND fs.status = 'completed'
        WHERE ${classWhere.join(' AND ')}
        GROUP BY c.id, sub.code, sub.name, d.name
        ORDER BY d.name, sub.name
        LIMIT 200
      `, classParams);

      // Terms for filter dropdown
      const { rows: terms } = await pool.query(
        `SELECT id, name, code, is_active FROM terms WHERE deleted_at IS NULL ORDER BY start_date DESC LIMIT 10`,
      );

      // Departments for filter dropdown
      const { rows: deptList } = await pool.query(
        `SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name`,
      );

      res.json({
        success: true,
        data: { departments: depts, classes, terms, deptList },
      });
    } catch (err) { next(err); }
  },
);

// ── Student: unread notification count ───────────────────────────────────────
// Lightweight endpoint for the notification bell badge.
// RBAC: student (own), admin.

router.get(
  '/student/:studentId/notifications/unread-count',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      if (req.user!.role === UserRole.STUDENT && req.user!.sub !== studentId) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } }); return;
      }
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS unread FROM notifications
         WHERE recipient_id = $1 AND status != 'read'`,
        [studentId],
      );
      res.json({ success: true, data: { unread: parseInt(rows[0].unread, 10) } });
    } catch (err) { next(err); }
  },
);

// ── Faculty: full report export (lecture-wise + summary + defaulters) ─────────
// Returns all data needed for PDF/Excel generation on the client.
// RBAC: faculty (own data) or admin.

router.get(
  '/faculty/:facultyId/reports/export',
  authenticate,
  authorize(UserRole.FACULTY, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId } = req.params;
      const { startDate, endDate, courseCode } = req.query;

      const conditions = [`swc.faculty_user_id = $1`];
      const params: unknown[] = [facultyId];
      let p = 2;
      if (startDate)  { conditions.push(`swc.scheduled_start >= $${p++}`); params.push(startDate); }
      if (endDate)    { conditions.push(`swc.scheduled_start <= $${p++}`); params.push(endDate); }
      if (courseCode) { conditions.push(`swc.course_code = $${p++}`);      params.push(courseCode); }

      // Faculty info
      const { rows: facultyRows } = await pool.query(
        `SELECT first_name, last_name, email FROM users WHERE id = $1`,
        [facultyId],
      );
      const faculty = facultyRows[0];

      // Lecture-wise
      const { rows: lectures } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.id AS session_id, swc.course_code, swc.course_name, swc.session_type,
          swc.scheduled_start, swc.scheduled_end, swc.location, swc.status,
          swc.expected_count, swc.present_count, swc.late_count, swc.absent_count,
          ROUND(100.0 * swc.present_count / NULLIF(swc.expected_count, 0), 1) AS attendance_pct
        FROM sessions_with_course swc
        WHERE ${conditions.join(' AND ')}
        ORDER BY swc.scheduled_start DESC
        LIMIT 500
      `, params);

      // Subject summary
      const { rows: summary } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          swc.course_code, swc.course_name,
          COUNT(swc.id)                                                 AS total_sessions,
          SUM(swc.expected_count)                                       AS total_expected,
          SUM(swc.present_count)                                        AS total_present,
          SUM(swc.late_count)                                           AS total_late,
          SUM(swc.absent_count)                                         AS total_absent,
          ROUND(100.0 * SUM(swc.present_count) / NULLIF(SUM(swc.expected_count), 0), 1) AS avg_pct
        FROM sessions_with_course swc
        WHERE ${conditions.join(' AND ')}
        GROUP BY swc.course_code, swc.course_name
        ORDER BY swc.course_name
      `, params);

      // Defaulters (< 75%)
      const { rows: defaulters } = await pool.query(`
        ${SESSION_CTE}
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          sp.student_id AS roll_number,
          swc.course_code, swc.course_name,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent')              AS absent,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id),0), 1)                               AS pct
        FROM sessions_with_course swc
        JOIN attendance_records ar ON ar.faculty_session_id = swc.id AND ar.deleted_at IS NULL
        JOIN users u ON u.id = ar.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY u.id, u.first_name, u.last_name, u.email, sp.student_id,
                 swc.course_code, swc.course_name
        HAVING ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
          / NULLIF(COUNT(ar.id),0), 1) < 75
        ORDER BY pct ASC
        LIMIT 500
      `, params);

      res.json({
        success: true,
        data: {
          meta: {
            faculty_name: faculty ? `${faculty.first_name} ${faculty.last_name}` : 'Faculty',
            faculty_email: faculty?.email ?? '',
            generated_at: new Date().toISOString(),
            filters: { startDate, endDate, courseCode },
          },
          lectures,
          summary,
          defaulters,
        },
      });
    } catch (err) { next(err); }
  },
);

// ── Admin: full report export ─────────────────────────────────────────────────
// Returns trend + defaulters + department summary for PDF/Excel generation.
// RBAC: admin only.

router.get(
  '/admin/reports/export',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = 'daily', startDate, endDate, departmentId } = req.query;

      const groupExpr =
        period === 'weekly'  ? `DATE_TRUNC('week',  fs.scheduled_start AT TIME ZONE 'UTC')` :
        period === 'monthly' ? `DATE_TRUNC('month', fs.scheduled_start AT TIME ZONE 'UTC')` :
                               `DATE(fs.scheduled_start AT TIME ZONE 'UTC')`;

      const dateConditions: string[] = ['ar.deleted_at IS NULL'];
      const params: unknown[] = [];
      let p = 1;
      if (startDate)    { dateConditions.push(`fs.scheduled_start >= $${p++}`); params.push(startDate); }
      if (endDate)      { dateConditions.push(`fs.scheduled_start <= $${p++}`); params.push(endDate); }

      const deptJoin      = departmentId ? `JOIN student_profiles sp2 ON sp2.user_id = ar.student_user_id` : '';
      const deptCondition = departmentId ? `AND sp2.department_id = $${p++}` : '';
      if (departmentId) params.push(departmentId);

      // Trend
      const { rows: trend } = await pool.query(`
        SELECT
          ${groupExpr}                                                  AS period,
          COUNT(DISTINCT fs.id)                                         AS sessions,
          COUNT(ar.id)                                                  AS total_records,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          COUNT(ar.id) FILTER (WHERE ar.status = 'absent')              AS absent,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM attendance_records ar
        JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
        ${deptJoin}
        WHERE ${dateConditions.join(' AND ')} ${deptCondition}
        GROUP BY ${groupExpr}
        ORDER BY period DESC
        LIMIT 200
      `, params);

      // Department summary
      const { rows: deptSummary } = await pool.query(`
        SELECT
          d.name AS department,
          COUNT(DISTINCT sp.user_id)                                    AS students,
          COUNT(ar.id)                                                  AS total_records,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM departments d
        LEFT JOIN student_profiles sp ON sp.department_id = d.id
        LEFT JOIN users u ON u.id = sp.user_id AND u.deleted_at IS NULL
        LEFT JOIN attendance_records ar ON ar.student_user_id = u.id AND ar.deleted_at IS NULL
        WHERE d.deleted_at IS NULL
        GROUP BY d.id, d.name ORDER BY d.name
      `);

      // Defaulters
      const { rows: defaulters } = await pool.query(`
        SELECT
          u.id, u.first_name, u.last_name, u.email,
          sp.student_id AS roll_number,
          d.name AS department,
          COUNT(ar.id)                                                  AS total,
          COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))   AS attended,
          ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
            / NULLIF(COUNT(ar.id), 0), 1)                              AS pct
        FROM attendance_records ar
        JOIN users u ON u.id = ar.student_user_id AND u.deleted_at IS NULL
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN departments d ON d.id = sp.department_id
        WHERE ar.deleted_at IS NULL
        GROUP BY u.id, u.first_name, u.last_name, u.email, sp.student_id, d.name
        HAVING ROUND(100.0 * COUNT(ar.id) FILTER (WHERE ar.status IN ('present','late'))
          / NULLIF(COUNT(ar.id), 0), 1) < 75
        ORDER BY pct ASC
        LIMIT 500
      `);

      res.json({
        success: true,
        data: {
          meta: {
            generated_at: new Date().toISOString(),
            filters: { period, startDate, endDate, departmentId },
          },
          trend,
          deptSummary,
          defaulters,
        },
      });
    } catch (err) { next(err); }
  },
);

export default router;

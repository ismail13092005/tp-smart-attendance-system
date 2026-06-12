/**
 * AttendanceService — uses raw SQL via pool to match the actual DB schema.
 * The Sequelize models are kept for reference but all DB operations go through pool.
 */
import pool from '../../database/pool';
import { FaceService } from '../face/face.service';
import { QRService } from '../qr/qr.service';
import { GeofenceService } from '../geofence/geofence.service';
import { AuditService } from '../audit/audit.service';
import { emailService } from '../../shared/email.service';
import { smsService } from '../../shared/sms.service';
import {
  AttendanceStatus,
  VerificationStep,
  Coordinates,
  RequestContext,
} from '../../shared/types';
import { NotFoundError, ValidationError, AttendanceVerificationError } from '../../shared/errors';
import logger from '../../shared/logger';

export class AttendanceService {
  private faceService: FaceService;
  private qrService: QRService;
  private geofenceService: GeofenceService;
  private auditService: AuditService;

  constructor() {
    this.faceService = new FaceService();
    this.qrService = new QRService();
    this.geofenceService = new GeofenceService();
    this.auditService = new AuditService();
  }

  /**
   * Mark attendance with full 3-factor verification.
   * ALL THREE CHECKS MUST PASS.
   */
  async markAttendance(params: {
    studentId: string;
    qrToken: string;
    faceImageData: Buffer;
    location: Coordinates;
    deviceInfo?: RequestContext;
  }): Promise<Record<string, unknown>> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── STEP 1: Verify QR ──────────────────────────────────────────────────
      logger.info(`Starting attendance verification for student: ${params.studentId}`);
      const qrResult = await this.qrService.verifyQRToken(params.qrToken);
      if (!qrResult.valid || !qrResult.sessionId) {
        await this.logFailedAttempt(params.studentId, null, VerificationStep.QR_SCAN,
          qrResult.reason || 'QR verification failed', params.deviceInfo);
        throw new AttendanceVerificationError(qrResult.reason || 'QR code verification failed', 'qr');
      }

      const sessionId = qrResult.sessionId;

      // Fetch session with class/term info
      const { rows: sessRows } = await client.query(`
        SELECT fs.id, fs.faculty_user_id, fs.status, fs.class_id,
               c.term_id,
               fs.scheduled_start, fs.scheduled_end,
               fs.late_threshold_mins,
               fs.present_count, fs.late_count, fs.absent_count, fs.expected_count
        FROM faculty_sessions fs
        LEFT JOIN classes c ON c.id = fs.class_id
        WHERE fs.id = $1 AND fs.deleted_at IS NULL
      `, [sessionId]);

      if (!sessRows[0]) throw new NotFoundError('Session not found');
      const session = sessRows[0];

      if (session.status !== 'active') {
        throw new ValidationError('Session is not active');
      }

      // ── Enforce attendance window: reject if scheduled end time has passed ──
      const now = new Date();
      const scheduledEnd = new Date(session.scheduled_end);
      if (now > scheduledEnd) {
        // Auto-close the session since it's past its end time
        await client.query(
          `UPDATE faculty_sessions SET status='completed', actual_end=$2, updated_at=NOW() WHERE id=$1`,
          [sessionId, scheduledEnd],
        );
        throw new ValidationError('This session has ended. Attendance window is closed.');
      }

      // Duplicate check
      const { rows: dupRows } = await client.query(
        `SELECT id FROM attendance_records
         WHERE faculty_session_id = $1 AND student_user_id = $2 AND deleted_at IS NULL`,
        [sessionId, params.studentId],
      );
      if (dupRows.length > 0) {
        await client.query('ROLLBACK');
        throw new ValidationError('Attendance already marked for this session');
      }

      // ── STEP 2: Verify Face ────────────────────────────────────────────────
      logger.info(`QR verified, proceeding to face verification for student: ${params.studentId}`);
      const faceResult = await this.faceService.verifyFace(params.studentId, params.faceImageData, {
        ip: params.deviceInfo?.ip,
        userAgent: params.deviceInfo?.userAgent,
        sessionId,
      });
      if (!faceResult.verified) {
        await this.logFailedAttempt(params.studentId, sessionId, VerificationStep.FACE_VERIFICATION,
          `Face verification failed (confidence: ${faceResult.confidenceScore})`, params.deviceInfo);
        throw new AttendanceVerificationError('Face verification failed', 'face');
      }

      // ── STEP 3: Verify Geofence ────────────────────────────────────────────
      logger.info(`Face verified, proceeding to geofence check for student: ${params.studentId}`);
      const geofenceResult = await this.geofenceService.verifyLocation(sessionId, params.location);
      if (!geofenceResult.withinGeofence) {
        await this.logFailedAttempt(params.studentId, sessionId, VerificationStep.GEOFENCE_CHECK,
          geofenceResult.reason || 'Location outside geofence', params.deviceInfo);
        throw new AttendanceVerificationError(geofenceResult.reason || 'Location verification failed', 'geofence');
      }

      // ── ALL CHECKS PASSED — Insert attendance record ───────────────────────
      logger.info(`All verifications passed, marking attendance for student: ${params.studentId}`);
      // Present = within 15 min of start; Late = after that but before end
      const lateThresholdMs = (session.late_threshold_mins ?? 15) * 60 * 1000;
      const isLate = now.getTime() > new Date(session.scheduled_start).getTime() + lateThresholdMs;
      const status = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

      const { rows: arRows } = await client.query(`
        INSERT INTO attendance_records (
          faculty_session_id, student_user_id, class_id, term_id,
          status, marked_at,
          qr_verified, qr_verified_at,
          face_verified, face_verified_at, face_confidence,
          geo_verified, geo_verified_at,
          marked_ip, marked_ua, device_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6,
          TRUE, $6,
          TRUE, $6, $7,
          TRUE, $6,
          $8, $9, $10
        )
        ON CONFLICT (faculty_session_id, student_user_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          marked_at = EXCLUDED.marked_at,
          qr_verified = TRUE, qr_verified_at = EXCLUDED.qr_verified_at,
          face_verified = TRUE, face_verified_at = EXCLUDED.face_verified_at,
          face_confidence = EXCLUDED.face_confidence,
          geo_verified = TRUE, geo_verified_at = EXCLUDED.geo_verified_at,
          updated_at = NOW()
        RETURNING *
      `, [
        sessionId, params.studentId,
        session.class_id || null,
        session.term_id || null,
        status, now,
        faceResult.confidenceScore ?? null,
        params.deviceInfo?.ip ?? null,
        params.deviceInfo?.userAgent ?? null,
        params.deviceInfo?.deviceId ?? null,
      ]);

      // Update session counts
      const countField = isLate ? 'late_count' : 'present_count';
      await client.query(
        `UPDATE faculty_sessions SET ${countField} = ${countField} + 1, updated_at = NOW() WHERE id = $1`,
        [sessionId],
      );

      await client.query('COMMIT');

      await this.auditService.log({
        userId: params.studentId,
        action: 'attendance_marked' as never,
        resource: 'attendance',
        resourceId: arRows[0].id,
        success: true,
        metadata: { sessionId, status, faceConfidence: faceResult.confidenceScore, distance: geofenceResult.distance },
        ip: params.deviceInfo?.ip,
        userAgent: params.deviceInfo?.userAgent,
        deviceId: params.deviceInfo?.deviceId,
      });

      logger.info(`Attendance marked successfully for student: ${params.studentId} in session: ${sessionId}`);

      // ── Send parent notification (fire-and-forget, never crash) ───────────
      this.sendParentNotification(params.studentId, sessionId, status, now).catch(err =>
        logger.warn('[AttendanceService] Parent notification failed:', err),
      );

      return arRows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get attendance records for a session (returns snake_case for API consistency).
   */
  async getSessionAttendance(sessionId: string): Promise<Record<string, unknown>[]> {
    const { rows } = await pool.query(`
      SELECT
        ar.id, ar.status, ar.marked_at, ar.face_confidence,
        ar.qr_verified, ar.face_verified, ar.geo_verified,
        ar.is_manual_override, ar.override_reason,
        u.id AS student_id, u.first_name, u.last_name, u.email,
        sp.student_id AS roll_number
      FROM attendance_records ar
      JOIN users u ON u.id = ar.student_user_id
      LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE ar.faculty_session_id = $1 AND ar.deleted_at IS NULL
      ORDER BY ar.marked_at ASC
    `, [sessionId]);
    return rows;
  }

  /**
   * Get attendance history for a student.
   */
  async getStudentAttendance(studentId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    courseCode?: string;
  }): Promise<Record<string, unknown>[]> {
    const conditions = ['ar.student_user_id = $1', 'ar.deleted_at IS NULL'];
    const params: unknown[] = [studentId];
    let p = 2;

    if (filters?.startDate) { conditions.push(`fs.scheduled_start >= $${p++}`); params.push(filters.startDate); }
    if (filters?.endDate)   { conditions.push(`fs.scheduled_start <= $${p++}`); params.push(filters.endDate); }
    if (filters?.courseCode) {
      conditions.push(`COALESCE(sub.code, 'N/A') = $${p++}`);
      params.push(filters.courseCode);
    }

    const { rows } = await pool.query(`
      SELECT
        ar.id, ar.status, ar.marked_at, ar.face_confidence, ar.is_manual_override,
        fs.scheduled_start, fs.scheduled_end, fs.location_name AS location, fs.session_type,
        COALESCE(sub.code, 'N/A') AS course_code,
        COALESCE(sub.name, 'N/A') AS course_name,
        u.first_name || ' ' || u.last_name AS faculty_name
      FROM attendance_records ar
      JOIN faculty_sessions fs ON fs.id = ar.faculty_session_id
      LEFT JOIN classes c ON c.id = fs.class_id
      LEFT JOIN subjects sub ON sub.id = c.subject_id
      JOIN users u ON u.id = fs.faculty_user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY fs.scheduled_start DESC
      LIMIT 200
    `, params);
    return rows;
  }

  /**
   * Manual attendance override by faculty/admin.
   * Uses raw SQL — no Sequelize dependency.
   */
  async manualOverride(params: {
    sessionId: string;
    studentId: string;
    status: AttendanceStatus;
    overriddenBy: string;
    reason: string;
  }): Promise<Record<string, unknown>> {
    // Verify session exists
    const { rows: sessRows } = await pool.query(
      `SELECT id, class_id,
              (SELECT term_id FROM classes WHERE id = fs.class_id) AS term_id
       FROM faculty_sessions fs WHERE id = $1 AND deleted_at IS NULL`,
      [params.sessionId],
    );
    if (!sessRows[0]) throw new NotFoundError('Session not found');

    const session = sessRows[0];

    // Verify student exists
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [params.studentId],
    );
    if (!userRows[0]) throw new NotFoundError('Student not found');

    // Check existing record
    const { rows: existing } = await pool.query(
      `SELECT id, status FROM attendance_records
       WHERE faculty_session_id = $1 AND student_user_id = $2 AND deleted_at IS NULL`,
      [params.sessionId, params.studentId],
    );

    let result: Record<string, unknown>;

    if (existing.length > 0) {
      // Update existing record
      const oldStatus = existing[0].status as string;
      const { rows } = await pool.query(`
        UPDATE attendance_records SET
          status = $1,
          is_manual_override = TRUE,
          overridden_by = $2,
          override_reason = $3,
          updated_at = NOW()
        WHERE faculty_session_id = $4 AND student_user_id = $5 AND deleted_at IS NULL
        RETURNING *
      `, [params.status, params.overriddenBy, params.reason, params.sessionId, params.studentId]);
      result = rows[0];

      // Adjust session counts
      await this.adjustSessionCounts(params.sessionId, oldStatus, params.status);
    } else {
      // Insert new record
      const { rows } = await pool.query(`
        INSERT INTO attendance_records (
          faculty_session_id, student_user_id, class_id, term_id,
          status, marked_at,
          is_manual_override, overridden_by, override_reason,
          qr_verified, face_verified, geo_verified
        ) VALUES (
          $1, $2, $3, $4,
          $5, NOW(), TRUE, $6, $7, FALSE, FALSE, FALSE
        )
        RETURNING *
      `, [
        params.sessionId, params.studentId,
        session.class_id || null,
        session.term_id || null,
        params.status,
        params.overriddenBy,
        params.reason,
      ]);
      result = rows[0];

      // Increment new status count
      await this.adjustSessionCounts(params.sessionId, null, params.status);
    }

    await this.auditService.log({
      userId: params.overriddenBy,
      action: 'manual_override' as never,
      resource: 'attendance',
      resourceId: result.id as string,
      success: true,
      metadata: {
        sessionId: params.sessionId,
        studentId: params.studentId,
        status: params.status,
        reason: params.reason,
      },
    });

    logger.info(`Manual attendance override by ${params.overriddenBy} for student ${params.studentId}`);
    return result;
  }

  private async adjustSessionCounts(
    sessionId: string,
    oldStatus: string | null,
    newStatus: string,
  ): Promise<void> {
    const updates: string[] = [];
    if (oldStatus === 'present') updates.push('present_count = GREATEST(0, present_count - 1)');
    if (oldStatus === 'late')    updates.push('late_count = GREATEST(0, late_count - 1)');
    if (oldStatus === 'absent')  updates.push('absent_count = GREATEST(0, absent_count - 1)');
    if (newStatus === 'present') updates.push('present_count = present_count + 1');
    if (newStatus === 'late')    updates.push('late_count = late_count + 1');
    if (newStatus === 'absent')  updates.push('absent_count = absent_count + 1');

    if (updates.length > 0) {
      await pool.query(
        `UPDATE faculty_sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`,
        [sessionId],
      );
    }
  }

  private async logFailedAttempt(
    studentId: string,
    sessionId: string | null,
    failedStep: VerificationStep,
    reason: string,
    deviceInfo?: RequestContext,
  ): Promise<void> {
    await this.auditService.log({
      userId: studentId,
      action: 'attendance_failed' as never,
      resource: 'attendance',
      resourceId: sessionId || undefined,
      success: false,
      errorMessage: reason,
      metadata: { failedStep },
      ...deviceInfo,
    });
    logger.warn(`Attendance verification failed for student ${studentId}: ${failedStep} - ${reason}`);
  }

  /**
   * Notify parents after attendance is marked.
   * Fetches parent contact info and sends email + SMS.
   * Never throws — all errors are caught and logged.
   */
  private async sendParentNotification(
    studentId: string,
    sessionId: string,
    status: AttendanceStatus,
    markedAt: Date,
  ): Promise<void> {
    try {
      // Fetch student info + parent contacts
      const { rows } = await pool.query(`
        SELECT
          u.first_name || ' ' || u.last_name AS student_name,
          sp.student_id AS roll_number,
          pu.email AS parent_email,
          pu.phone AS parent_phone,
          COALESCE(sub.code, (fs.notes::jsonb->>'courseCode'), 'N/A') AS course_code,
          COALESCE(sub.name, (fs.notes::jsonb->>'courseName'), 'N/A') AS course_name,
          fs.location_name AS location
        FROM users u
        LEFT JOIN student_profiles sp ON sp.user_id = u.id
        JOIN parent_student_links psl ON psl.student_user_id = u.id AND psl.deleted_at IS NULL
        JOIN users pu ON pu.id = psl.parent_user_id AND pu.deleted_at IS NULL
        JOIN faculty_sessions fs ON fs.id = $2
        LEFT JOIN classes c ON c.id = fs.class_id
        LEFT JOIN subjects sub ON sub.id = c.subject_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `, [studentId, sessionId]);

      if (rows.length === 0) return; // no parents linked

      const dateTimeStr = markedAt.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      for (const row of rows) {
        const notifParams = {
          studentName: row.student_name,
          rollNumber:  row.roll_number ?? 'N/A',
          subject:     `${row.course_code} — ${row.course_name}`,
          dateTime:    dateTimeStr,
          status:      status as 'present' | 'late' | 'absent',
          location:    row.location ?? 'N/A',
        };

        if (row.parent_email) {
          await emailService.sendAttendanceNotification({
            parentEmail: row.parent_email,
            ...notifParams,
          });
        }

        if (row.parent_phone) {
          await smsService.sendAttendanceNotification({
            parentPhone: row.parent_phone,
            ...notifParams,
          });
        }
      }
    } catch (err) {
      logger.warn('[AttendanceService] sendParentNotification error:', err);
    }
  }
}

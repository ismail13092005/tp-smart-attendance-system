/**
 * Daily attendance report scheduler
 * Runs every day at 18:00 (6 PM) server time.
 * For each parent, sends one in-app notification per child
 * summarising today's attended and missed lectures.
 */
import { v4 as uuidv4 } from 'uuid';
import pool from '../../database/pool';
import logger from '../../shared/logger';

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startDailyReportScheduler(): void {
  scheduleNext();
  logger.info('[DailyReport] Scheduler started — fires at 18:00 daily');
}

function scheduleNext(): void {
  const now = new Date();
  const next = new Date(now);
  next.setHours(18, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // already past 6 PM today

  const msUntil = next.getTime() - now.getTime();
  logger.info(`[DailyReport] Next run in ${Math.round(msUntil / 60000)} minutes (${next.toISOString()})`);

  setTimeout(async () => {
    await runDailyReport();
    scheduleNext(); // schedule the next day
  }, msUntil);
}

// ── Core job ──────────────────────────────────────────────────────────────────

async function runDailyReport(): Promise<void> {
  logger.info('[DailyReport] Running daily parent notification job…');

  try {
    // Get all active parent→student links
    const { rows: links } = await pool.query(`
      SELECT
        psl.parent_user_id,
        psl.student_user_id,
        u.first_name || ' ' || u.last_name AS student_name
      FROM parent_student_links psl
      JOIN users u ON u.id = psl.student_user_id
      WHERE psl.deleted_at IS NULL
    `);

    if (links.length === 0) {
      logger.info('[DailyReport] No parent-student links found, skipping.');
      return;
    }

    const today = new Date();
    const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(today); dayEnd.setHours(23, 59, 59, 999);

    let sent = 0;

    for (const link of links) {
      try {
        await sendReportForChild(link.parent_user_id, link.student_user_id, link.student_name, dayStart, dayEnd);
        sent++;
      } catch (err) {
        logger.error(`[DailyReport] Failed for parent=${link.parent_user_id} student=${link.student_user_id}`, err);
      }
    }

    logger.info(`[DailyReport] Done — sent ${sent}/${links.length} notifications`);
  } catch (err) {
    logger.error('[DailyReport] Job failed', err);
  }
}

// ── Per-child report ──────────────────────────────────────────────────────────

async function sendReportForChild(
  parentId: string,
  studentId: string,
  studentName: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<void> {
  // Fetch all sessions scheduled today for this student's enrolled classes
  const { rows: sessions } = await pool.query(`
    SELECT
      fs.id AS session_id,
      fs.scheduled_start,
      fs.scheduled_end,
      fs.location_name,
      fs.session_type,
      COALESCE(sub.code,  (fs.notes::jsonb->>'courseCode'),  'N/A') AS course_code,
      COALESCE(sub.name,  (fs.notes::jsonb->>'courseName'),  'N/A') AS course_name,
      u.first_name || ' ' || u.last_name AS faculty_name,
      ar.status AS attendance_status,
      ar.marked_at
    FROM faculty_sessions fs
    LEFT JOIN classes c    ON c.id = fs.class_id
    LEFT JOIN subjects sub ON sub.id = c.subject_id
    JOIN users u ON u.id = fs.faculty_user_id
    LEFT JOIN attendance_records ar
      ON ar.faculty_session_id = fs.id
      AND ar.student_user_id = $1
      AND ar.deleted_at IS NULL
    WHERE fs.scheduled_start >= $2
      AND fs.scheduled_start <= $3
      AND fs.deleted_at IS NULL
      AND fs.status IN ('active', 'completed')
    ORDER BY fs.scheduled_start ASC
  `, [studentId, dayStart, dayEnd]);

  if (sessions.length === 0) {
    // No sessions today — no notification needed
    return;
  }

  const attended = sessions.filter(s => s.attendance_status === 'present' || s.attendance_status === 'late');
  const missed   = sessions.filter(s => !s.attendance_status || s.attendance_status === 'absent');

  const dateStr = dayStart.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Build title
  const title = `${studentName}'s Attendance — ${dateStr}`;

  // Build body
  const lines: string[] = [];

  if (attended.length > 0) {
    lines.push(`✅ Attended (${attended.length}/${sessions.length}):`);
    for (const s of attended) {
      const time = new Date(s.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const late = s.attendance_status === 'late' ? ' (late)' : '';
      lines.push(`  • ${s.course_code} — ${s.course_name} at ${time}${late}`);
    }
  }

  if (missed.length > 0) {
    lines.push('');
    lines.push(`❌ Missed (${missed.length}/${sessions.length}):`);
    for (const s of missed) {
      const time = new Date(s.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      lines.push(`  • ${s.course_code} — ${s.course_name} at ${time}`);
    }
  }

  if (missed.length === 0) {
    lines.push('');
    lines.push('🎉 Perfect attendance today!');
  }

  const body = lines.join('\n');

  // Insert notification
  await pool.query(`
    INSERT INTO notifications
      (id, recipient_id, type, channel, status, title, body, payload, sent_at)
    VALUES ($1, $2, 'parent_alert', 'in_app', 'sent', $3, $4, $5, NOW())
  `, [
    uuidv4(),
    parentId,
    title,
    body,
    JSON.stringify({
      studentId,
      studentName,
      date: dayStart.toISOString().split('T')[0],
      attendedCount: attended.length,
      missedCount: missed.length,
      totalCount: sessions.length,
      sessions: sessions.map(s => ({
        sessionId:   s.session_id,
        courseCode:  s.course_code,
        courseName:  s.course_name,
        time:        s.scheduled_start,
        status:      s.attendance_status ?? 'absent',
      })),
    }),
  ]);
}

export { runDailyReport }; // exported for manual trigger / testing

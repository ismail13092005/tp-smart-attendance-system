/**
 * Session auto-close scheduler
 * Runs every 60 seconds.
 * Finds all 'active' sessions whose scheduled_end has passed and marks them 'completed'.
 * This ensures students cannot mark attendance after the lecture ends,
 * even if the faculty forgot to manually end the session.
 */
import pool from '../../database/pool';
import logger from '../../shared/logger';

const CHECK_INTERVAL_MS = 60_000; // every 60 seconds

export function startSessionAutoCloseScheduler(): void {
  // Run immediately on startup to catch any sessions that expired while server was down
  autoCloseSessions();
  // Then run on interval
  setInterval(autoCloseSessions, CHECK_INTERVAL_MS);
  logger.info('[SessionAutoClose] Scheduler started — checks every 60 seconds');
}

async function autoCloseSessions(): Promise<void> {
  try {
    const { rows } = await pool.query(`
      UPDATE faculty_sessions
      SET
        status     = 'completed',
        actual_end = scheduled_end,
        updated_at = NOW()
      WHERE
        status       = 'active'
        AND scheduled_end < NOW()
        AND deleted_at IS NULL
      RETURNING id, scheduled_end,
        COALESCE(notes::jsonb->>'courseCode', 'N/A') AS course_code
    `);

    if (rows.length > 0) {
      logger.info(
        `[SessionAutoClose] Auto-closed ${rows.length} expired session(s): ` +
        rows.map(r => `${r.course_code}(${r.id.slice(0, 8)})`).join(', ')
      );
    }
  } catch (err) {
    logger.error('[SessionAutoClose] Failed to auto-close sessions', err);
  }
}

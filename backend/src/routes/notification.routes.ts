import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import pool from '../database/pool';
import { runDailyReport } from '../modules/notifications/daily-report.scheduler';

const router = Router();

// GET /api/notifications — fetch notifications for the logged-in user
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, type, channel, status, title, body, payload, sent_at, read_at, created_at
      FROM notifications
      WHERE recipient_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user!.sub]);
    res.json({ success: true, data: { notifications: rows } });
  } catch (err) { next(err); }
});

// POST /api/notifications/:id/read — mark a notification as read
router.post('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`
      UPDATE notifications SET read_at = NOW(), status = 'read', updated_at = NOW()
      WHERE id = $1 AND recipient_id = $2
    `, [req.params.id, req.user!.sub]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`
      UPDATE notifications SET read_at = NOW(), status = 'read', updated_at = NOW()
      WHERE recipient_id = $1 AND read_at IS NULL
    `, [req.user!.sub]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/trigger-daily-report — manual trigger for testing
router.post('/trigger-daily-report', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await runDailyReport();
    res.json({ success: true, message: 'Daily report sent' });
  } catch (err) { next(err); }
});

export default router;

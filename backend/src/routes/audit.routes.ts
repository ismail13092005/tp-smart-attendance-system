import { Router, Request, Response, NextFunction } from 'express';
import { AuditService } from '../modules/audit/audit.service';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../shared/types';

const router = Router();
const auditService = new AuditService();

/**
 * @route   GET /api/audit/logs
 * @desc    Get audit logs
 * @access  Private (Admin)
 */
router.get(
  '/logs',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { logs, total } = await auditService.getLogs({
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
      });

      res.json({
        success: true,
        data: { logs, total },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

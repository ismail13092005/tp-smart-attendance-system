/**
 * User routes
 *
 * GET    /api/users/me                  — current user profile
 * PUT    /api/users/me                  — update own profile
 * GET    /api/users                     — list users (admin)
 * GET    /api/users/:userId             — get user by ID (admin or self)
 * PUT    /api/users/:userId             — admin update user
 * DELETE /api/users/:userId/deactivate  — admin deactivate user
 * PUT    /api/users/:userId/role        — admin change role
 */

import { Router, Request, Response, NextFunction } from 'express';
import { usersService } from '../modules/users/users.service';
import {
  authenticate,
  can,
  requireSelf,
  attachRequestContext,
} from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import { Permission } from '../shared/permissions';
import { z } from 'zod';

const router = Router();
router.use(attachRequestContext);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 */
router.get(
  '/me',
  authenticate,
  can(Permission.USER_READ_SELF),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getById(req.user!.sub);
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update own profile
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/me',
  authenticate,
  can(Permission.USER_UPDATE_SELF),
  validate(schemas.updateUser),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateSelf(
        req.user!.sub,
        req.body,
        req.requestContext,
      );
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [student, faculty, admin, parent] }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get(
  '/',
  authenticate,
  can(Permission.USER_LIST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await usersService.list({
        role:   req.query.role   as any,
        status: req.query.status as any,
        search: req.query.search as string,
        page:   parseInt(req.query.page  as string) || 1,
        limit:  parseInt(req.query.limit as string) || 20,
      });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (admin or self)
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:userId',
  authenticate,
  requireSelf('userId'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getById(req.params.userId);
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/{userId}:
 *   put:
 *     tags: [Users]
 *     summary: Admin update any user
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:userId',
  authenticate,
  can(Permission.USER_UPDATE_ANY),
  validate(schemas.updateUser.extend({
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.adminUpdateUser(
        req.params.userId,
        req.body,
        req.user!.sub,
        req.requestContext,
      );
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/{userId}/deactivate:
 *   delete:
 *     tags: [Users]
 *     summary: Deactivate a user account (admin only)
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/:userId/deactivate',
  authenticate,
  can(Permission.USER_DEACTIVATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await usersService.deactivate(
        req.params.userId,
        req.user!.sub,
        req.requestContext,
      );
      res.json({ success: true, message: 'User deactivated' });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/users/{userId}/role:
 *   put:
 *     tags: [Users]
 *     summary: Change a user's role (admin only)
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:userId/role',
  authenticate,
  can(Permission.USER_CHANGE_ROLE),
  validate(z.object({ role: z.enum(['student', 'faculty', 'admin', 'parent']) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.changeRole(
        req.params.userId,
        req.body.role,
        req.user!.sub,
        req.requestContext,
      );
      res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

export default router;

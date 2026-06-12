/**
 * Auth routes
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/refresh
 * POST /api/auth/logout
 * POST /api/auth/change-password
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * GET  /api/auth/sessions
 * DELETE /api/auth/sessions/:sessionId
 * DELETE /api/auth/sessions          (revoke all)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../modules/auth/auth.service';
import { tokenService } from '../modules/auth/token.service';
import { authenticate, attachRequestContext } from '../middleware/auth.middleware';
import { validate, schemas } from '../middleware/validation.middleware';
import {
  authLimiter,
  passwordLimiter,
  refreshLimiter,
} from '../middleware/rate-limit.middleware';

const router = Router();

// All auth routes get request context attached
router.use(attachRequestContext);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName, role]
 *             properties:
 *               email:     { type: string, format: email }
 *               password:  { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName:  { type: string }
 *               role:      { type: string, enum: [student, faculty, admin, parent] }
 *               phone:     { type: string }
 *     responses:
 *       201:
 *         description: User created
 *       409:
 *         description: Email already registered
 *       400:
 *         description: Validation error
 */
router.post(
  '/register',
  authLimiter,
  validate(schemas.register),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.register(req.body, req.requestContext);
      res.status(201).json({ success: true, data: { user } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:         { $ref: '#/components/schemas/User' }
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *                 expiresAt:    { type: string, format: date-time }
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts
 */
router.post(
  '/login',
  authLimiter,
  validate(schemas.login),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.login(email, password, req.requestContext);
      res.json({
        success: true,
        data: {
          user:         result.user,
          accessToken:  result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt:    result.tokens.expiresAt,
          sessionId:    result.tokens.sessionId,
        },
      });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get new access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh',
  refreshLimiter,
  validate(schemas.refresh),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await authService.refresh(req.body.refreshToken, req.requestContext);
      res.json({
        success: true,
        data: {
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
        },
      });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke current session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.logout(
        req.user!.sub,
        req.user!.sessionId,
        req.requestContext,
      );
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:     { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed. All other sessions revoked.
 *       401:
 *         description: Current password incorrect
 */
router.post(
  '/change-password',
  authenticate,
  validate(schemas.changePassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.changePassword(
        req.user!.sub,
        req.body.currentPassword,
        req.body.newPassword,
        req.requestContext,
      );
      res.json({ success: true, message: 'Password changed. Please log in again.' });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Reset email sent (always 200 to prevent enumeration)
 */
router.post(
  '/forgot-password',
  passwordLimiter,
  validate(schemas.forgotPassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = await authService.forgotPassword(req.body.email, req.requestContext);
      // In production: send token via email. In dev: return it directly.
      const devData = process.env.NODE_ENV !== 'production' && token
        ? { resetToken: token }
        : undefined;
      res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
        ...(devData && { dev: devData }),
      });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using token from email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:       { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       401:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password',
  passwordLimiter,
  validate(schemas.resetPassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await authService.resetPassword(
        req.body.token,
        req.body.newPassword,
        req.requestContext,
      );
      res.json({ success: true, message: 'Password reset successful. Please log in.' });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/sessions:
 *   get:
 *     tags: [Auth]
 *     summary: List active device sessions for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get(
  '/sessions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await tokenService.listActiveSessions(req.user!.sub);
      // Mask sensitive fields
      const safe = sessions.map(s => ({
        id:           s.id,
        platform:     s.platform,
        deviceName:   s.device_name,
        ipAddress:    s.ip_address,
        lastActiveAt: s.last_active_at,
        expiresAt:    s.expires_at,
        createdAt:    s.created_at,
        isCurrent:    s.id === req.user!.sessionId,
      }));
      res.json({ success: true, data: { sessions: safe } });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke a specific session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session revoked
 *       403:
 *         description: Cannot revoke another user's session
 */
router.delete(
  '/sessions/:sessionId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify the session belongs to this user
      const sessions = await tokenService.listActiveSessions(req.user!.sub);
      const owns = sessions.some(s => s.id === req.params.sessionId);
      if (!owns) {
        return next(new (await import('../shared/errors')).ForbiddenError(
          'Session not found or does not belong to you',
        ));
      }
      await tokenService.revokeSession(req.params.sessionId, 'user_revoked');
      res.json({ success: true, message: 'Session revoked' });
    } catch (err) { next(err); }
  },
);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/auth/sessions:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke all sessions except current
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked
 */
router.delete(
  '/sessions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Revoke all then re-issue current session's active flag
      await tokenService.revokeAllUserSessions(req.user!.sub, 'user_revoked_all');
      // Keep current session alive
      await import('../database/pool').then(({ pool: p }) =>
        p.query(
          `UPDATE device_sessions SET is_active = TRUE, revoked_at = NULL, revoke_reason = NULL
           WHERE id = $1`,
          [req.user!.sessionId],
        ),
      );
      res.json({ success: true, message: 'All other sessions revoked' });
    } catch (err) { next(err); }
  },
);

export default router;

/**
 * Auth middleware
 *
 * authenticate  — verifies JWT, checks session is still active in DB
 * can(perm)     — permission-matrix guard (replaces scattered role checks)
 * requireSelf   — ensures the acting user matches the target resource owner
 * optionalAuth  — attaches user if token present, never throws
 */

import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../modules/auth/token.service';
import { roleHasPermission, PermissionKey } from '../shared/permissions';
import {
  UnauthorizedError,
  ForbiddenError,
  TokenExpiredError,
  TokenInvalidError,
} from '../shared/errors';
import { JWTPayload, UserRole } from '../shared/types';
import logger from '../shared/logger';

// ── Augment Express Request ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      requestContext: {
        ip: string;
        userAgent: string;
        deviceId?: string;
        platform?: string;
      };
    }
  }
}

// ── Request context extractor (attach early in pipeline) ─────────────────────

export const attachRequestContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  req.requestContext = {
    ip:        req.ip ?? req.socket.remoteAddress ?? 'unknown',
    userAgent: req.get('user-agent') ?? 'unknown',
    deviceId:  req.get('x-device-id') ?? undefined,
    platform:  req.get('x-platform')  ?? undefined,
  };
  next();
};

// ── authenticate ─────────────────────────────────────────────────────────────

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token   = authHeader.slice(7);
    const payload = tokenService.verifyAccessToken(token);

    // Validate session is still active in DB (catches revoked tokens)
    const active = await tokenService.isSessionActive(payload.sessionId, payload.jti);
    if (!active) {
      throw new UnauthorizedError('Session has been revoked');
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError || err instanceof TokenInvalidError) {
      next(err);
    } else {
      next(err);
    }
  }
};

// ── can(permission) ───────────────────────────────────────────────────────────
// Usage: router.get('/path', authenticate, can(Permission.USER_LIST), handler)

export const can = (permission: PermissionKey) => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!roleHasPermission(req.user.role, permission)) {
    logger.warn('Permission denied', {
      userId: req.user.sub,
      role:   req.user.role,
      permission,
      path:   req.path,
    });
    return next(new ForbiddenError(`Permission denied: ${permission}`));
  }

  next();
};

// ── authorize (legacy role-list guard — kept for backward compat) ─────────────

export const authorize = (...allowedRoles: UserRole[]) => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) return next(new UnauthorizedError('Authentication required'));
  if (!allowedRoles.includes(req.user.role)) {
    return next(new ForbiddenError('Insufficient permissions'));
  }
  next();
};

// ── requireSelf ───────────────────────────────────────────────────────────────
// Ensures req.user.sub === req.params[paramName], unless user is admin.
// Usage: router.get('/users/:userId/...', authenticate, requireSelf('userId'), handler)

export const requireSelf = (paramName = 'userId') => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) return next(new UnauthorizedError('Authentication required'));

  const isAdmin = req.user.role === UserRole.ADMIN;
  const isSelf  = req.user.sub === req.params[paramName];

  if (!isAdmin && !isSelf) {
    return next(new ForbiddenError('Access denied'));
  }
  next();
};

// ── optionalAuth ──────────────────────────────────────────────────────────────

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token   = authHeader.slice(7);
      const payload = tokenService.verifyAccessToken(token);
      req.user = payload;
    }
  } catch {
    // Silently ignore — optional auth never throws
  }
  next();
};

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../shared/errors';

const handler = (message: string) =>
  (_req: Request, _res: Response, next: NextFunction) => {
    next(new TooManyRequestsError(message));
  };

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: handler('Too many login attempts. Try again in 15 minutes.'),
});

export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  handler: handler('Too many password reset attempts. Try again in 1 hour.'),
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  handler: handler('Too many token refresh attempts.'),
});

export const attendanceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  handler: handler('Too many attendance attempts. Try again in 5 minutes.'),
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  handler: handler('Too many requests. Please slow down.'),
});

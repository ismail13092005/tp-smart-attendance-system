import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../shared/errors';

export const validate = (schema: ZodSchema) => (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = (result.error as ZodError).issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return next(new ValidationError(message));
  }
  req.body = result.data;
  next();
};

/** Backward-compat alias used by older route files */
export const runValidation = validate;

export const schemas = {
  login: z.object({
    email:    z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
  register: z.object({
    email:     z.string().email('Invalid email'),
    password:  z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1).max(80),
    lastName:  z.string().min(1).max(80),
    role:      z.enum(['student', 'faculty', 'admin', 'parent']),
    phone:     z.string().optional(),
  }),
  refresh: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8),
  }),
  forgotPassword: z.object({
    email: z.string().email(),
  }),
  resetPassword: z.object({
    token:       z.string().min(1),
    newPassword: z.string().min(8),
  }),
  updateUser: z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName:  z.string().min(1).max(80).optional(),
    phone:     z.string().optional(),
  }),
  revokeSession: z.object({
    sessionId: z.string().uuid(),
  }),
};

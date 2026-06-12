// ─────────────────────────────────────────────────────────────────────────────
// Application error hierarchy
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    code?: string,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(message, 400, true, 'VALIDATION_ERROR'); }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') { super(message, 401, true, 'UNAUTHORIZED'); }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403, true, 'FORBIDDEN'); }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(message, 404, true, 'NOT_FOUND'); }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, true, 'CONFLICT'); }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') { super(message, 429, true, 'RATE_LIMITED'); }
}

export class AttendanceVerificationError extends AppError {
  public readonly failedCheck: 'qr' | 'face' | 'geofence';
  constructor(message: string, failedCheck: 'qr' | 'face' | 'geofence') {
    super(message, 422, true, 'VERIFICATION_FAILED');
    this.failedCheck = failedCheck;
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired') { super(message, 401, true, 'TOKEN_EXPIRED'); }
}

export class TokenInvalidError extends AppError {
  constructor(message = 'Token is invalid') { super(message, 401, true, 'TOKEN_INVALID'); }
}

export class AccountSuspendedError extends AppError {
  constructor(message = 'Account is suspended') { super(message, 403, true, 'ACCOUNT_SUSPENDED'); }
}

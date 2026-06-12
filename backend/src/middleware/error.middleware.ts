import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import logger from '../shared/logger';
import config from '../config';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('AppError 5xx', { message: err.message, path: req.path, stack: err.stack });
    } else {
      logger.warn('AppError 4xx', { message: err.message, code: err.code, path: req.path });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code:    err.code,
        ...(config.env === 'development' && { stack: err.stack }),
      },
    });
    return;
  }

  logger.error('Unhandled error', { error: err, path: req.path, method: req.method });

  res.status(500).json({
    success: false,
    error: {
      message: config.env === 'production' ? 'Internal server error' : err.message,
      code:    'INTERNAL_ERROR',
    },
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code:    'NOT_FOUND',
    },
  });
};

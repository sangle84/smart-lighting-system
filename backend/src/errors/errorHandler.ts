import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError.js';
import { ValidationError } from './HttpErrors.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(getStatusCode(err.code)).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Unknown error → INTERNAL_ERROR
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Lỗi hệ thống',
    details: process.env.NODE_ENV === 'production' ? null : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: 'Không tìm thấy route',
    details: null,
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validationErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(400).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Zod validation error
  if (err instanceof Error && 'issues' in err) {
    const zodError = err as any;
    const fieldErrors = zodError.issues?.map((i: any) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ',
      details: fieldErrors,
    });
    return;
  }

  _next(err);
}

function getStatusCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'INVALID_LIFECYCLE_TRANSITION':
      return 400;
    case 'UNAUTHORIZED':
    case 'INVALID_CREDENTIALS':
      return 401;
    case 'FORBIDDEN':
    case 'ACCOUNT_LOCKED':
      return 403;
    case 'NOT_FOUND':
    case 'DEVICE_NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'USERNAME_EXISTS':
    case 'DEVICE_EXISTS':
    case 'DEVICE_NOT_AVAILABLE':
      return 409;
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
}

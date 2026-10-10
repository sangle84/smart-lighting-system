import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('FORBIDDEN', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

export class InternalError extends AppError {
  constructor(message: string, details?: unknown) {
    super('INTERNAL_ERROR', message, details);
  }
}

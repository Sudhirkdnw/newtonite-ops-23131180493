import type { ApiErrorDetail } from '@newtonite/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_SERVER_ERROR',
    isOperational = true,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: ApiErrorDetail[]) {
    super(message, 404, 'NOT_FOUND', true, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: ApiErrorDetail[]) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: ApiErrorDetail[]) {
    super(message, 401, 'UNAUTHORIZED', true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = 'You do not have permission to perform this action',
    details?: ApiErrorDetail[]
  ) {
    super(message, 403, 'FORBIDDEN', true, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource state conflict', details?: ApiErrorDetail[]) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ApiErrorDetail[]) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
  }
}

import type { Response } from 'express';
import type { ApiResponseSuccess, ApiResponseError, ApiErrorDetail } from '@newtonite/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ApiResponseSuccess<T>['meta']
): Response {
  const payload: ApiResponseSuccess<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      requestId: (res.req as { id?: string }).id,
    },
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errorCode = 'INTERNAL_SERVER_ERROR',
  details?: ApiErrorDetail[]
): Response {
  const payload: ApiResponseError = {
    success: false,
    error: {
      message,
      code: errorCode,
      statusCode,
      requestId: (res.req as { id?: string }).id,
      details,
    },
  };
  return res.status(statusCode).json(payload);
}

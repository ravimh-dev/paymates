import { Response } from 'express';
import { HTTP_STATUS } from './constants';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode: number = HTTP_STATUS.OK,
  meta?: ApiResponse<T>['meta']
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Created successfully'
): Response => {
  return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  errors?: unknown
): Response => {
  const response: ApiResponse = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, HTTP_STATUS.UNAUTHORIZED);

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
  sendError(res, message, HTTP_STATUS.FORBIDDEN);

export const sendNotFound = (res: Response, message = 'Resource not found'): Response =>
  sendError(res, message, HTTP_STATUS.NOT_FOUND);

export const sendBadRequest = (res: Response, message: string, errors?: unknown): Response =>
  sendError(res, message, HTTP_STATUS.BAD_REQUEST, errors);

export const sendConflict = (res: Response, message: string): Response =>
  sendError(res, message, HTTP_STATUS.CONFLICT);

export const sendValidationError = (res: Response, errors: unknown): Response =>
  sendError(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE, errors);

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable, machine-readable error codes. The web app translates these into
 * Arabic/English messages, so the API never has to localise text itself.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  SKU_TAKEN: 'SKU_TAKEN',
  NAME_TAKEN: 'NAME_TAKEN',
  INVALID_REFERENCE: 'INVALID_REFERENCE',
  IN_USE: 'IN_USE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_STATUS: 'INVALID_STATUS',
  EMPTY_ORDER: 'EMPTY_ORDER',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'DISCOUNT_EXCEEDS_SUBTOTAL',
  AMOUNT_EXCEEDS_OUTSTANDING: 'AMOUNT_EXCEEDS_OUTSTANDING',
  ALREADY_VOIDED: 'ALREADY_VOIDED',
  WRONG_CURRENT_PASSWORD: 'WRONG_CURRENT_PASSWORD',
  LAST_OWNER: 'LAST_OWNER',
  CANNOT_MODIFY_SELF: 'CANNOT_MODIFY_SELF',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details } satisfies ErrorBody, status);
  }
}

export const notFound = (entity: string) =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${entity} not found`, {
    entity,
  });

export const badRequest = (code: ErrorCode, message: string, details?: unknown) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message, details);

export const conflict = (code: ErrorCode, message: string, details?: unknown) =>
  new AppException(HttpStatus.CONFLICT, code, message, details);

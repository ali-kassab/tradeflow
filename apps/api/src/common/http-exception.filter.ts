import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { ErrorCode, type ErrorBody } from './errors.js';

const statusToCode: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
};

/**
 * Turns every error into `{ statusCode, code, message, details? }`.
 * Unknown errors are logged server-side and returned as a generic 500 so stack
 * traces, SQL and other internals never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return response as ErrorBody;
      }
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        code: statusToCode[status] ?? ErrorCode.INTERNAL_ERROR,
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { statusCode: 409, code: ErrorCode.CONFLICT, message: 'Duplicate value' };
        case 'P2003':
          return {
            statusCode: 400,
            code: ErrorCode.INVALID_REFERENCE,
            message: 'A referenced record does not exist',
          };
        case 'P2020':
          // e.g. stock or a computed order total beyond the INT / DECIMAL(14,2) range.
          return { statusCode: 400, code: ErrorCode.VALIDATION_ERROR, message: 'Value out of range' };
        case 'P2025':
          return { statusCode: 404, code: ErrorCode.NOT_FOUND, message: 'Record not found' };
      }
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }
}

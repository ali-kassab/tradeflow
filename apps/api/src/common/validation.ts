import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';
import { AppException, ErrorCode } from './errors.js';

/**
 * Like `@IsOptional()`, but only `undefined` skips validation. An explicit `null`
 * is validated (and rejected by the other decorators), which is what non-nullable
 * columns need: `{ "name": null }` must be a 400, not a database error.
 */
export const IsOptionalNotNull = () => ValidateIf((_, value) => value !== undefined);

/** Trims string input; leaves anything else for the type validators to reject. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Largest id SQL Server's INT columns can hold. */
export const MAX_ID = 2_147_483_647;

/**
 * `ParseIntPipe` for route ids: also rejects values outside the INT range
 * (e.g. `/products/100000000000000000000`), which would otherwise reach Prisma
 * and fail as an internal error. Such ids cannot exist, so they answer 404.
 */
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^-?\d+$/.test(value)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Validation failed (numeric string is expected)',
      );
    }
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || id > MAX_ID) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Record not found');
    }
    return id;
  }
}

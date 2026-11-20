import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export const skipTake = (q: PageQueryDto) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

export function paginated<T>(data: T[], total: number, q: PageQueryDto): Paginated<T> {
  return {
    data,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
    },
  };
}

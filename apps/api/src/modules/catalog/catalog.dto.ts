import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/pagination.js';
import { IsOptionalNotNull } from '../../common/validation.js';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const Money = () => IsNumber({ maxDecimalPlaces: 2 });
export const MAX_MONEY = 999_999_999_999.99;

export class CategoryDto {
  @ApiProperty()
  @trim()
  @IsString()
  @Length(1, 100)
  name: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'RICE-5KG' })
  @trim()
  @Matches(/^[A-Za-z0-9._-]{1,60}$/, { message: 'sku may contain letters, digits, . _ - only' })
  sku: string;

  @ApiProperty({ example: 'أرز مصري 5 كجم' })
  @trim()
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiPropertyOptional({ example: 'carton' })
  @IsOptionalNotNull()
  @trim()
  @IsString()
  @Length(1, 30)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  categoryId?: number | null;

  @ApiPropertyOptional({ description: 'Hidden from STAFF users' })
  @IsOptionalNotNull()
  @Money()
  @Min(0)
  @Max(MAX_MONEY)
  costPrice?: number;

  @ApiProperty({ description: 'Default wholesale selling price' })
  @Money()
  @Min(0)
  @Max(MAX_MONEY)
  salePrice: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  reorderLevel?: number;

  @ApiPropertyOptional({ default: 0, description: 'Initial stock, recorded as an OPENING movement' })
  @IsOptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  openingStock?: number;
}

// skipNullProperties: false → an explicit null is validated, so only categoryId
// (declared @IsOptional) can be cleared with null; the other columns are NOT NULL.
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['openingStock'] as const), {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional()
  @IsOptionalNotNull()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'active';

  @ApiPropertyOptional({ description: 'Only products at or below their reorder level' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  lowStock?: boolean;
}

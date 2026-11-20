import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { type AuthUser, CurrentUser, OwnerOnly } from '../../common/auth.js';
import { PrismaService } from '../../prisma/prisma.service.js';

class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({ example: 'EGP', description: 'ISO 4217 code' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 14, description: 'Default VAT % for new sales orders' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultTaxRate?: number;
}

const tenantSelect = { id: true, name: true, currency: true, defaultTaxRate: true } as const;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  get(actor: AuthUser) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: actor.tenantId }, select: tenantSelect });
  }

  update(actor: AuthUser, dto: UpdateTenantDto) {
    return this.prisma.tenant.update({ where: { id: actor.tenantId }, data: dto, select: tenantSelect });
  }
}

@ApiTags('tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.tenant.get(user);
  }

  @OwnerOnly()
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenant.update(user, dto);
  }
}

@Module({ controllers: [TenantController], providers: [TenantService] })
export class TenantModule {}

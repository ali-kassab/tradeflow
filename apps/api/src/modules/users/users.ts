import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import * as argon2 from 'argon2';
import { Role } from '../../common/enums.js';
import { type AuthUser, CurrentUser, OwnerOnly } from '../../common/auth.js';
import { ErrorCode, badRequest, conflict, notFound } from '../../common/errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';

class CreateUserDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(190)
  email: string;

  @ApiProperty({ minLength: 8, description: 'Temporary password; share it with the user directly.' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

class UpdateUserDto extends PartialType(PickType(CreateUserDto, ['name', 'role'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class ResetPasswordDto extends PickType(CreateUserDto, ['password'] as const) {}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthUser) {
    return this.prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      select: userSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw conflict(ErrorCode.EMAIL_TAKEN, 'Email already registered');
    return this.prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: await argon2.hash(dto.password),
      },
      select: userSelect,
    });
  }

  async update(actor: AuthUser, id: number, dto: UpdateUserDto) {
    const target = await this.find(actor, id);
    if (target.id === actor.id && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw badRequest(ErrorCode.CANNOT_MODIFY_SELF, 'You cannot change your own role or status');
    }
    const losesOwner =
      target.role === Role.OWNER &&
      ((dto.role !== undefined && dto.role !== Role.OWNER) || dto.isActive === false);
    if (losesOwner) {
      const owners = await this.prisma.user.count({
        where: { tenantId: actor.tenantId, role: Role.OWNER, isActive: true },
      });
      if (owners <= 1) throw badRequest(ErrorCode.LAST_OWNER, 'A business needs at least one owner');
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: dto, select: userSelect });
      if (dto.isActive === false) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
  }

  async resetPassword(actor: AuthUser, id: number, dto: ResetPasswordDto) {
    await this.find(actor, id);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash: await argon2.hash(dto.password) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async find(actor: AuthUser, id: number) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!user) throw notFound('User');
    return user;
  }
}

@ApiTags('users')
@ApiBearerAuth()
@OwnerOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.users.resetPassword(user, id, dto);
    return { ok: true };
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}

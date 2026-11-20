import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '../../generated/prisma/client.js';
import type { AccessTokenPayload, AuthUser } from '../../common/auth.js';
import { AppException, ErrorCode, conflict } from '../../common/errors.js';
import type { AppConfig } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto.js';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  userId: number;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

// Verifying against a fixed hash when the email is unknown keeps the response
// time similar, so login timing does not reveal which emails are registered.
const DUMMY_HASH = argon2.hash('tradeflow-timing-equaliser');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedSession> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw conflict(ErrorCode.EMAIL_TAKEN, 'Email already registered');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: dto.businessName } });
      return tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: Role.OWNER,
          lastLoginAt: new Date(),
        },
      });
    });
    return this.issue(user.id, user.tenantId, randomUUID());
  }

  async login(dto: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await argon2.verify(user?.passwordHash ?? (await DUMMY_HASH), dto.password);
    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
      );
    }
    if (!user.isActive) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.ACCOUNT_DISABLED, 'Account disabled');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user.id, user.tenantId, randomUUID());
  }

  /**
   * Rotates the refresh token. Presenting an already-rotated token means it was
   * stolen or replayed, so the whole token family is revoked (reuse detection).
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) throw invalidRefresh();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: { select: { id: true, tenantId: true, isActive: true } } },
    });
    if (!stored) throw invalidRefresh();

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw invalidRefresh();
    }
    if (stored.expiresAt <= new Date() || !stored.user.isActive) throw invalidRefresh();

    // Conditional update: only one concurrent refresh can win the rotation.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw invalidRefresh();

    return this.issue(stored.user.id, stored.user.tenantId, stored.family);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (stored) {
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async me(user: AuthUser) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
      select: { id: true, name: true, currency: true, defaultTaxRate: true },
    });
    return { user, tenant };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await argon2.verify(record.passwordHash, dto.currentPassword))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.WRONG_CURRENT_PASSWORD,
        'Current password is incorrect',
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await argon2.hash(dto.newPassword) },
      }),
      // Sign out every other device.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issue(userId: number, tenantId: number, family: string): Promise<IssuedSession> {
    const payload: AccessTokenPayload = { sub: userId, tid: tenantId };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(32).toString('base64url');
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const refreshExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), family, expiresAt: refreshExpiresAt },
    });
    return { accessToken, refreshToken, refreshExpiresAt, userId };
  }
}

const invalidRefresh = () =>
  new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN, 'Session expired');

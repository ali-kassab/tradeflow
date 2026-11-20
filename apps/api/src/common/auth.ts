import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppException, ErrorCode } from './errors.js';

/** The authenticated principal. `tenantId` always comes from here, never from input. */
export interface AuthUser {
  id: number;
  tenantId: number;
  role: Role;
  name: string;
  email: string;
}

export interface AccessTokenPayload {
  sub: number;
  tid: number;
}

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the listed roles. Routes without it allow any signed-in role. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const ManagerOrAbove = () => Roles(Role.OWNER, Role.MANAGER);
export const OwnerOnly = () => Roles(Role.OWNER);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);

export const canSeeCosts = (user: AuthUser) => user.role !== Role.STAFF;

/**
 * Global guard: verifies the bearer token, then reloads the user so that a
 * deactivated account or a changed role takes effect on the very next request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw unauthorized();
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tid },
      select: { id: true, tenantId: true, role: true, name: true, email: true, isActive: true },
    });
    if (!user) throw unauthorized();
    if (!user.isActive) {
      throw new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.ACCOUNT_DISABLED, 'Account disabled');
    }

    req.user = { id: user.id, tenantId: user.tenantId, role: user.role, name: user.name, email: user.email };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(user.role)) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, 'Insufficient permissions');
    }
    return true;
  }
}

const unauthorized = () =>
  new AppException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED, 'Authentication required');

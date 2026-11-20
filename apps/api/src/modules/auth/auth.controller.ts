import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { type AuthUser, CurrentUser, Public } from '../../common/auth.js';
import type { AppConfig } from '../../config/env.js';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService, type IssuedSession } from './auth.service.js';

export const REFRESH_COOKIE = 'tf_refresh';
const COOKIE_PATH = '/api/auth';

// Tight limits on credential endpoints to slow down brute-force attempts.
const AuthThrottle = () => Throttle({ default: { limit: 10, ttl: 60_000 } });

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @AuthThrottle()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.register(dto), res);
  }

  @Public()
  @AuthThrottle()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.login(dto), res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]), res);
    } catch (e) {
      this.clearCookie(res);
      throw e;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @AuthThrottle()
  @HttpCode(204)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user, dto);
  }

  /** The refresh token only ever travels in an httpOnly cookie, never in the body. */
  private respond(session: IssuedSession, res: Response) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return { accessToken: session.accessToken };
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }
}

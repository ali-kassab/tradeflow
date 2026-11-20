import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ErrorCode, badRequest } from './common/errors.js';
import type { AppConfig } from './config/env.js';

/** Flattens class-validator output into `[{ field, constraints: [...] }]`. */
function flatten(errors: ValidationError[], parent = ''): { field: string; constraints: string[] }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, constraints: Object.keys(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Shared by main.ts and the e2e tests so both run the exact same pipeline. */
export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService<AppConfig, true>);
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }).split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        badRequest(ErrorCode.VALIDATION_ERROR, 'Validation failed', flatten(errors)),
    }),
  );
}

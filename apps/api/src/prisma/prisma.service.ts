import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../config/env.js';

/** Converts the Prisma-style `mysql://` URL to the MariaDB driver format. */
export function toDriverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl.replace(/^mysql:/, 'mariadb:'));
  // MySQL 8 defaults to caching_sha2_password; over a local non-TLS connection
  // the driver must be allowed to fetch the server's RSA public key.
  if (!url.searchParams.has('allowPublicKeyRetrieval')) {
    url.searchParams.set('allowPublicKeyRetrieval', 'true');
  }
  return url.toString();
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaMariaDb(toDriverUrl(databaseUrl)) });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      adapter: new PrismaMariaDb(toDriverUrl(config.get('DATABASE_URL', { infer: true }))),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client.js';
import type { AppConfig } from '../config/env.js';

/**
 * The SQL Server driver adapter understands Prisma's own connection-string format
 * (`sqlserver://host:port;database=…;user=…;password=…;encrypt=…`), so the CLI and
 * the runtime share one DATABASE_URL.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaMssql(databaseUrl) });
}

/** Reads `database=` from a Prisma SQL Server connection string (used by test safety checks). */
export function databaseName(databaseUrl: string): string | null {
  const match = /;\s*(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(databaseUrl);
  return match ? match[1].trim() : null;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<AppConfig, true>) {
    super({ adapter: new PrismaMssql(config.get('DATABASE_URL', { infer: true })) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

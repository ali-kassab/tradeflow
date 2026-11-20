import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './common/auth.js';
import { AllExceptionsFilter } from './common/http-exception.filter.js';
import { type AppConfig, validateEnv } from './config/env.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PartiesModule } from './modules/parties/parties.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module.js';
import { TenantModule } from './modules/tenant/tenant.js';
import { UsersModule } from './modules/users/users.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }) as `${number}m`,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 300 }],
        // The e2e suite fires many logins from one IP; rate limits are not under test there.
        skipIf: () => config.get('NODE_ENV', { infer: true }) === 'test',
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantModule,
    CatalogModule,
    InventoryModule,
    PartiesModule,
    SalesOrdersModule,
    PurchaseOrdersModule,
    PaymentsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

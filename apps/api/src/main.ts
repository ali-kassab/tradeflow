import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/env.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const config = app.get(ConfigService<AppConfig, true>);
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('TradeFlow API')
      .setDescription('Bilingual B2B wholesale management platform — REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`TradeFlow API listening on http://localhost:${port}/api (docs: /api/docs)`, 'Bootstrap');
}
await bootstrap();

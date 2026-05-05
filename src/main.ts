import './observability/newrelic';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  configureApp(app);

  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);
  logger.log(`LivePoly server listening on port ${port}`);
}
bootstrap();

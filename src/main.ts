import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const API_PREFIX = 'api';

const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://livepoly.vercel.app',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
  });

  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);
  logger.log(`LivePoly server listening on port ${port}`);
}
bootstrap();

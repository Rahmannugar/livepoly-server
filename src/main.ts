import './infra/observability/newrelic';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { SERVER_TIMEOUTS } from './config/app.constants';
import { SocketIoAdapter } from './infra/realtime/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new SocketIoAdapter(app, configService));

  configureApp(app);

  const port = configService.getOrThrow<number>('PORT');
  const server = app.getHttpServer();

  server.requestTimeout = SERVER_TIMEOUTS.requestTimeoutMs;
  server.headersTimeout = SERVER_TIMEOUTS.headersTimeoutMs;
  server.keepAliveTimeout = SERVER_TIMEOUTS.keepAliveTimeoutMs;

  await app.listen(port);
  logger.log(`LivePoly server listening on port ${port}`);
}

void bootstrap();

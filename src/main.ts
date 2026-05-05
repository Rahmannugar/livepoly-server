import './observability/newrelic';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  API_DOCUMENTATION,
  API_PREFIX,
  CORS_ORIGINS,
  SWAGGER_PATH,
} from './config/app.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.getOrThrow<number>('PORT');

  const swaggerConfig = new DocumentBuilder()
    .setTitle(API_DOCUMENTATION.title)
    .setDescription(API_DOCUMENTATION.description)
    .setVersion(API_DOCUMENTATION.version)
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(SWAGGER_PATH, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`LivePoly server listening on port ${port}`);
}
bootstrap();

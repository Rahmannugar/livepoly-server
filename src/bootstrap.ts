import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import {
  API_DOCUMENTATION,
  API_PREFIX,
  CORS_ORIGINS,
  SWAGGER_PATH,
} from './config/app.constants';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(API_DOCUMENTATION.title)
    .setDescription(API_DOCUMENTATION.description)
    .setVersion(API_DOCUMENTATION.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by login or refresh',
      },
      'accessToken',
    )
    .addCookieAuth('refreshToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refreshToken',
      description: 'HTTP-only refresh token cookie set by login/oauth/refresh',
    })
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(SWAGGER_PATH, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

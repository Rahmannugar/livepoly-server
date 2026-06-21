import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpRouteContract } from './common/http/http-route-contract';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import {
  API_DOCUMENTATION,
  CORS_ORIGINS,
  SWAGGER_PATH,
} from './config/app.constants';
import { ignoreNewRelicHealthTransactions } from './infra/observability/newrelic-health-ignore.middleware';

export function configureApp(app: INestApplication): void {
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.set('trust proxy', 1);

  app.use(ignoreNewRelicHealthTransactions);
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
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const apiPublicUrl =
    process.env.API_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'http://localhost:3002');

  const documentBuilder = new DocumentBuilder()
    .setTitle(API_DOCUMENTATION.title)
    .setDescription(
      `${API_DOCUMENTATION.description}\n\n[Download OpenAPI JSON](/openapi.json)`,
    )
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
    });

  if (apiPublicUrl) {
    documentBuilder.addServer(
      apiPublicUrl,
      process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
    );
  }

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    documentBuilder.build(),
  );

  const httpRouteContract = new HttpRouteContract(swaggerDocument, [
    {
      path: '/openapi.json',
      methods: ['GET', 'HEAD'],
    },
  ]);

  app.useGlobalFilters(new AllExceptionsFilter(httpRouteContract));

  expressApp.get('/openapi.json', (_request, response: Response) => {
    response.json(swaggerDocument);
  });

  SwaggerModule.setup(SWAGGER_PATH, app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

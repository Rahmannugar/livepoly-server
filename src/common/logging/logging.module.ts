import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import {
  getRequestPath,
  shouldSuppressHttpRequestLog,
} from '../observability/http-telemetry-policy';
import { RequestWithId } from '../types/request-with-id';

const REQUEST_ID_HEADER = 'x-request-id';

function isValidRequestId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
}

type RequestLogContext = IncomingMessage & {
  id?: string | number | object;
  baseUrl?: string;
  route?: { path?: unknown };
  params?: unknown;
  user?: {
    id?: unknown;
    role?: unknown;
  };
};

function requestCompletionObject(
  request: IncomingMessage,
  response: ServerResponse,
  value: unknown,
) {
  const context = request as RequestLogContext;
  const routePath =
    typeof context.route?.path === 'string'
      ? `${context.baseUrl ?? ''}${context.route.path}`
      : getRequestPath(request.url);

  return {
    requestId:
      typeof context.id === 'string' || typeof context.id === 'number'
        ? context.id
        : undefined,
    http: {
      method: request.method,
      route: routePath,
      statusCode: response.statusCode,
      durationMs: getResponseTime(value),
    },
    actor: getActor(context),
    entity: getEntityIdentifiers(context.params),
  };
}

function getResponseTime(value: unknown): number | undefined {
  if (!value || typeof value !== 'object' || !('responseTime' in value)) {
    return undefined;
  }

  return typeof value.responseTime === 'number'
    ? Math.round(value.responseTime)
    : undefined;
}

function getActor(request: RequestLogContext) {
  const userId = request.user?.id;
  const role = request.user?.role;

  if (typeof userId !== 'string') {
    return undefined;
  }

  return {
    userId,
    role: typeof role === 'string' ? role : undefined,
  };
}

function getEntityIdentifiers(params: unknown) {
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  const allowedKeys = [
    'code',
    'gameId',
    'friendshipId',
    'notificationId',
    'username',
  ];
  const identifiers = Object.fromEntries(
    allowedKeys.flatMap((key) => {
      const value = Reflect.get(params, key) as unknown;
      return typeof value === 'string' ? [[key, value]] : [];
    }),
  );

  return Object.keys(identifiers).length > 0 ? identifiers : undefined;
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        autoLogging: {
          ignore: (request) =>
            shouldSuppressHttpRequestLog(request.method, request.url),
        },
        quietReqLogger: true,
        quietResLogger: true,
        customLogLevel: (_request, response, error) => {
          if (error || response.statusCode >= 500) return 'error';
          if (response.statusCode >= 400) return 'warn';
          return 'info';
        },
        customSuccessMessage: (_request, response) =>
          response.statusCode >= 400
            ? 'http.request.failed'
            : 'http.request.completed',
        customErrorMessage: () => 'http.request.failed',
        customSuccessObject: (request, response, value: unknown) =>
          requestCompletionObject(request, response, value),
        customErrorObject: (request, response, error, value: unknown) => ({
          ...requestCompletionObject(request, response, value),
          error: {
            name: error.name,
            message: error.message,
          },
        }),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                },
              },
        genReqId: (request, response) => {
          const incomingRequestId = request.headers[REQUEST_ID_HEADER];
          const requestId =
            typeof incomingRequestId === 'string' &&
            isValidRequestId(incomingRequestId)
              ? incomingRequestId
              : randomUUID();

          (request as RequestWithId).requestId = requestId;
          response.setHeader(REQUEST_ID_HEADER, requestId);

          return requestId;
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      },
      forRoutes: ['*path'],
    }),
  ],
})
export class LoggingModule {}

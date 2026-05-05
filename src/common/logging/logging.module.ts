import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RequestWithId } from '../types/request-with-id';

const REQUEST_ID_HEADER = 'x-request-id';

function isValidRequestId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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

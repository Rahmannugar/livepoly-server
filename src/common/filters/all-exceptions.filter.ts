import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { HttpRouteContract } from '../http/http-route-contract';
import { RequestWithId } from '../types/request-with-id';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpRouteContract?: HttpRouteContract) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    const originalStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const allowedMethods =
      originalStatus === Number(HttpStatus.NOT_FOUND)
        ? this.httpRouteContract?.isUnsupportedMethod(
            request.path,
            request.method,
          )
        : null;

    const status = allowedMethods
      ? HttpStatus.METHOD_NOT_ALLOWED
      : originalStatus;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    if (allowedMethods) {
      response.setHeader('Allow', allowedMethods.join(', '));
    }

    response.status(status).json({
      success: false,
      error: {
        code: this.resolveCode(status, exceptionResponse),
        statusCode: status,
        message: allowedMethods
          ? 'Method not allowed'
          : this.resolveMessage(exceptionResponse, exception),
      },
      meta: {
        requestId: request.requestId,
      },
    });
  }

  private resolveCode(status: number, exceptionResponse: unknown): string {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'code' in exceptionResponse
    ) {
      const code = exceptionResponse.code;

      if (typeof code === 'string' && code.trim()) {
        return code;
      }
    }

    return HttpStatus[status] ?? 'HTTP_ERROR';
  }

  private resolveMessage(
    exceptionResponse: unknown,
    exception: unknown,
  ): string {
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message = exceptionResponse.message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}

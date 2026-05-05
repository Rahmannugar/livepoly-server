import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { RequestWithId } from '../types/request-with-id';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    response.status(status).json({
      success: false,
      error: {
        code: this.resolveCode(status),
        statusCode: status,
        message: this.resolveMessage(exceptionResponse, exception),
      },
      meta: {
        requestId: request.requestId,
      },
    });
  }

  private resolveCode(status: number): string {
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
      const message = (exceptionResponse as { message: unknown }).message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }
}

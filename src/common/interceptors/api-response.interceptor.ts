import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { RequestWithId } from '../types/request-with-id';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    statusCode: number;
    requestId?: string;
  };
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          statusCode: response.statusCode,
          requestId: request.requestId,
        },
      })),
    );
  }
}

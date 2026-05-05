import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incomingRequestId = request.header(REQUEST_ID_HEADER);
    const requestId =
      incomingRequestId && this.isValidRequestId(incomingRequestId)
        ? incomingRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }

  private isValidRequestId(value: string): boolean {
    return /^[a-zA-Z0-9._:-]{1,128}$/.test(value);
  }
}

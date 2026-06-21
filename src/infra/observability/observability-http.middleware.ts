import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { shouldIgnoreHttpTransaction } from '../../common/observability/http-telemetry-policy';
import { ObservabilityService } from './observability.service';

@Injectable()
export class ObservabilityHttpMiddleware implements NestMiddleware {
  constructor(private readonly observabilityService: ObservabilityService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (shouldIgnoreHttpTransaction(request.method, request.originalUrl)) {
      this.observabilityService.ignoreCurrentTransaction();
    }

    next();
  }
}

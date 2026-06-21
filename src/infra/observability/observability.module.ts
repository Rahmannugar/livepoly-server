import { Module } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { ObservabilityHttpMiddleware } from './observability-http.middleware';

@Module({
  providers: [ObservabilityService, ObservabilityHttpMiddleware],
  exports: [ObservabilityService, ObservabilityHttpMiddleware],
})
export class ObservabilityModule {}

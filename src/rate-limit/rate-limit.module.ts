import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { ObservabilityModule } from '../observability/observability.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [CacheModule, ObservabilityModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}

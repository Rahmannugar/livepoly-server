import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [CacheModule, ObservabilityModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}

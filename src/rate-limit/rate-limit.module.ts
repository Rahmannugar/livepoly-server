import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [CacheModule, ObservabilityModule],
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}

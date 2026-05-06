import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '../observability/observability.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [ConfigModule, ObservabilityModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}

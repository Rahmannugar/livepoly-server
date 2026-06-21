import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { HealthController } from './health.controller';

@Module({
  imports: [CacheModule, DatabaseModule, ObservabilityModule],
  controllers: [HealthController],
})
export class HealthModule {}

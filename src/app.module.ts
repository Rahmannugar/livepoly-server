import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, HealthModule],
})
export class AppModule {}

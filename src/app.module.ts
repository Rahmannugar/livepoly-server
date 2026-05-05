import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';


@Module({
  imports: [AppConfigModule, LoggingModule, HealthModule, DatabaseModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    HealthModule,
    DatabaseModule,
    MailModule,
    AuthModule,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './infra/database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './infra/queue/queue.module';
import { UsersModule } from './users/users.module';
import { FriendsModule } from './friends/friends.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    HealthModule,
    DatabaseModule,
    QueueModule,
    MailModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    NotificationsModule,
    RoomsModule,
  ],
})
export class AppModule {}

import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
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
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { GameModule } from './game/game.module';
import { AdminModule } from './admin/admin.module';
import { ObservabilityModule } from './infra/observability/observability.module';
import { ObservabilityHttpMiddleware } from './infra/observability/observability-http.middleware';

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
    GameModule,
    LeaderboardsModule,
    AdminModule,
    ObservabilityModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ObservabilityHttpMiddleware).forRoutes({
      path: '*path',
      method: RequestMethod.ALL,
    });
  }
}

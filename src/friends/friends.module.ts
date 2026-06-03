import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { FriendsController } from './friends.controller';
import { FriendsRepository } from './friends.repository';
import { FriendsService } from './friends.service';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    RateLimitModule,
    NotificationsModule,
    OutboxModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository],
  exports: [FriendsService],
})
export class FriendsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { FriendsController } from './friends.controller';
import { FriendsRateLimitService } from './friends-rate-limit.service';
import { FriendsRepository } from './friends.repository';
import { FriendsService } from './friends.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    ObservabilityModule,
    RateLimitModule,
    NotificationsModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository, FriendsRateLimitService],
  exports: [FriendsService],
})
export class FriendsModule {}

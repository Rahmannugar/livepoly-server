import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { FriendsController } from './friends.controller';
import { FriendsRateLimitService } from './friends-rate-limit.service';
import { FriendsRepository } from './friends.repository';
import { FriendsService } from './friends.service';

@Module({
  imports: [AuthModule, DatabaseModule, ObservabilityModule, RateLimitModule],
  controllers: [FriendsController],
  providers: [FriendsService, FriendsRepository, FriendsRateLimitService],
  exports: [FriendsService],
})
export class FriendsModule {}

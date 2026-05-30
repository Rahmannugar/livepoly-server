import { Module } from '@nestjs/common';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsRepository } from './leaderboards.repository';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  imports: [CacheModule, DatabaseModule, RateLimitModule],
  controllers: [LeaderboardsController],
  providers: [LeaderboardsRepository, LeaderboardsService],
  exports: [LeaderboardsService],
})
export class LeaderboardsModule {}

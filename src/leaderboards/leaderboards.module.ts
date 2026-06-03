import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { LeaderboardQueueService } from './jobs/leaderboard-queue.service';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsRepository } from './leaderboards.repository';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.game }),
    AuthModule,
    CacheModule,
    DatabaseModule,
    RateLimitModule,
  ],
  controllers: [LeaderboardsController],
  providers: [
    LeaderboardsRepository,
    LeaderboardsService,
    LeaderboardQueueService,
  ],
  exports: [LeaderboardsService, LeaderboardQueueService],
})
export class LeaderboardsModule {}

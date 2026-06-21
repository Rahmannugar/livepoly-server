import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service';
import { LeaderboardQueueService } from './leaderboard-queue.service';

const LEADERBOARD_SCHEDULER_LOCK_KEY = 'worker:singleton:leaderboard-scheduler';
const LEADERBOARD_SCHEDULER_LOCK_TTL_SECONDS = 60;

@Injectable()
export class LeaderboardRefreshScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly leaderboardQueueService: LeaderboardQueueService,
    private readonly cacheService: CacheService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.cacheService.withLockOrSkip({
      key: LEADERBOARD_SCHEDULER_LOCK_KEY,
      ttlSeconds: LEADERBOARD_SCHEDULER_LOCK_TTL_SECONDS,
      callback: () => this.leaderboardQueueService.enqueueScheduledRefresh(),
    });
  }
}

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { LeaderboardQueueService } from './leaderboard-queue.service';

@Injectable()
export class LeaderboardRefreshScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly leaderboardQueueService: LeaderboardQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.leaderboardQueueService.enqueueScheduledRefresh();
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LEADERBOARD_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';
import type { RefreshLeaderboardSnapshotsJob } from '../leaderboards.types';
import {
  REFRESH_DEBOUNCE_MS,
  REFRESH_EVERY_MS,
  REFRESH_JOB_ID,
  REPEAT_REFRESH_JOB_ID,
} from '../leaderboards.constants';

@Injectable()
export class LeaderboardQueueService {
  constructor(@InjectQueue(QUEUES.game) private readonly gameQueue: Queue) {}

  async enqueueGameFinishedRefresh(): Promise<void> {
    await this.gameQueue.add(
      LEADERBOARD_JOBS.refreshSnapshots,
      { reason: 'game_finished' } satisfies RefreshLeaderboardSnapshotsJob,
      {
        jobId: REFRESH_JOB_ID,
        delay: REFRESH_DEBOUNCE_MS,
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: 100,
      },
    );
  }

  async enqueueScheduledRefresh(): Promise<void> {
    await this.gameQueue.add(
      LEADERBOARD_JOBS.refreshSnapshots,
      { reason: 'scheduled' } satisfies RefreshLeaderboardSnapshotsJob,
      {
        jobId: REPEAT_REFRESH_JOB_ID,
        repeat: { every: REFRESH_EVERY_MS },
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: 100,
      },
    );
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import type { DeletedUserCleanupJob } from './users-jobs.types';

@Injectable()
export class UsersQueueService {
  constructor(@InjectQueue(QUEUES.users) private readonly usersQueue: Queue) {}

  async enqueueDeletedUserCleanup(data: DeletedUserCleanupJob) {
    await this.usersQueue.add(USER_JOBS.cleanupDeletedUser, data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import type {
  DeleteAvatarJob,
  DeletedUserCleanupJob,
} from './users-jobs.types';

@Injectable()
export class UsersQueueService {
  constructor(@InjectQueue(QUEUES.users) private readonly usersQueue: Queue) {}

  async enqueueDeletedUserCleanup(data: DeletedUserCleanupJob) {
    await this.usersQueue.add(USER_JOBS.cleanupDeletedUser, data, {
      jobId: `cleanup-deleted-user:${data.userId}`,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: 100,
    });
  }

  async enqueueDeleteAvatar(data: DeleteAvatarJob) {
    await this.usersQueue.add(USER_JOBS.deleteAvatar, data, {
      jobId: `delete-avatar:${data.objectKey}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });
  }
}

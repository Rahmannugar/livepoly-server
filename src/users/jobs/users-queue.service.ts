import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import { USER_AVATAR } from '../users.constants';
import type {
  DeleteAvatarJob,
  DeletedUserCleanupJob,
  VerifyAvatarUploadJob,
} from './users-jobs.types';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';

@Injectable()
export class UsersQueueService {
  constructor(@InjectQueue(QUEUES.users) private readonly usersQueue: Queue) {}

  async enqueueDeletedUserCleanup(data: DeletedUserCleanupJob) {
    await this.usersQueue.add(USER_JOBS.cleanupDeletedUser, data, {
      jobId: `cleanup-deleted-user:${data.userId}`,
      attempts: 3,
      backoff: exponentialBackoffWithJitter({ delay: 10_000 }),
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });
  }

  async enqueueDeleteAvatar(data: DeleteAvatarJob) {
    await this.usersQueue.add(USER_JOBS.deleteAvatar, data, {
      jobId: `delete-avatar:${data.objectKey}`,
      attempts: 3,
      backoff: exponentialBackoffWithJitter({ delay: 10_000 }),
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });
  }

  async enqueueVerifyAvatarUpload(data: VerifyAvatarUploadJob) {
    await this.usersQueue.add(USER_JOBS.verifyAvatarUpload, data, {
      jobId: `verify-avatar-upload:${data.uploadId}`,
      delay: (USER_AVATAR.uploadExpiresInSeconds + 30) * 1000,
      attempts: 3,
      backoff: exponentialBackoffWithJitter({ delay: 10_000 }),
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });
  }
}

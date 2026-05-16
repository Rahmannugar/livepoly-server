import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import type {
  CleanupAvatarUploadJob,
  DeleteAvatarJob,
  DeletedUserCleanupJob,
} from './users-jobs.types';
import { USER_AVATAR } from '../users.constants';

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

  async enqueueAvatarUploadCleanup(data: CleanupAvatarUploadJob) {
    await this.usersQueue.add(USER_JOBS.cleanupAvatarUpload, data, {
      jobId: `cleanup-avatar-upload:${data.uploadId}`,
      delay: (USER_AVATAR.uploadExpiresInSeconds + 120) * 1000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });
  }
}

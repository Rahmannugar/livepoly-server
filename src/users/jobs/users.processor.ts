import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CacheService } from '../../infra/cache/cache.service';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import { StorageService } from '../../infra/storage/storage.service';
import { MailQueueService } from '../../mail/jobs/mail-queue.service';
import { UsersMediaRepository } from '../repositories/users-media.repository';
import { USER_AVATAR_UPLOAD_STATUS } from '../users.constants';
import type {
  CleanupAvatarUploadJob,
  DeleteAvatarJob,
  DeletedUserCleanupJob,
} from './users-jobs.types';

@Processor(QUEUES.users)
export class UsersProcessor extends WorkerHost {
  private readonly logger = new Logger(UsersProcessor.name);

  constructor(
    private readonly mailQueueService: MailQueueService,
    private readonly cacheService: CacheService,
    private readonly storageService: StorageService,
    private readonly usersMediaRepository: UsersMediaRepository,
  ) {
    super();
  }

  async process(
    job: Job<DeletedUserCleanupJob | DeleteAvatarJob | CleanupAvatarUploadJob>,
  ) {
    if (job.name === USER_JOBS.cleanupDeletedUser) {
      await this.processDeletedUserCleanup(job as Job<DeletedUserCleanupJob>);
      return;
    }

    if (job.name === USER_JOBS.deleteAvatar) {
      await this.processDeleteAvatar(job as Job<DeleteAvatarJob>);
      return;
    }

    if (job.name === USER_JOBS.cleanupAvatarUpload) {
      await this.processCleanupAvatarUpload(job as Job<CleanupAvatarUploadJob>);
      return;
    }

    this.logger.warn({
      message: 'Unknown users job received',
      jobId: job.id,
      jobName: job.name,
    });
  }

  private async processDeletedUserCleanup(job: Job<DeletedUserCleanupJob>) {
    this.logger.log({
      message: 'Deleted user cleanup started',
      jobId: job.id,
      userId: job.data.userId,
      username: job.data.username,
    });

    await this.cacheService.withLock({
      key: `lock:users:cleanup-deleted-user:${job.data.userId}`,
      ttlSeconds: 5 * 60,
      waitTimeoutMs: 1000,
      callback: async () => {
        await this.deleteAvatarObject({
          jobId: job.id,
          userId: job.data.userId,
          objectKey: job.data.avatarObjectKey,
          source: USER_JOBS.cleanupDeletedUser,
        });

        await this.cleanupFriendships(job);
        await this.cleanupNotifications(job);
        await this.cleanupDevices(job);
        await this.archiveAnalytics(job);
        await this.sendAccountDeletedEmail(job);
      },
    });

    this.logger.log({
      message: 'Deleted user cleanup completed',
      jobId: job.id,
      userId: job.data.userId,
      username: job.data.username,
    });
  }

  private async processDeleteAvatar(job: Job<DeleteAvatarJob>) {
    this.logger.log({
      message: 'Avatar delete started',
      jobId: job.id,
      userId: job.data.userId,
      objectKey: job.data.objectKey,
    });

    await this.cacheService.withLock({
      key: `lock:users:delete-avatar:${job.data.objectKey}`,
      ttlSeconds: 5 * 60,
      waitTimeoutMs: 1000,
      callback: async () => {
        await this.deleteAvatarObject({
          jobId: job.id,
          userId: job.data.userId,
          objectKey: job.data.objectKey,
          source: USER_JOBS.deleteAvatar,
        });
      },
    });

    this.logger.log({
      message: 'Avatar delete completed',
      jobId: job.id,
      userId: job.data.userId,
      objectKey: job.data.objectKey,
    });
  }

  private async deleteAvatarObject(input: {
    jobId?: string;
    userId: string;
    objectKey: string | null;
    source: string;
  }) {
    if (!input.objectKey) {
      this.logger.log({
        message: 'Avatar delete skipped',
        reason: 'no_avatar',
        jobId: input.jobId,
        userId: input.userId,
        source: input.source,
      });

      return;
    }

    await this.storageService.deleteObject(input.objectKey);

    this.logger.log({
      message: 'Avatar delete completed',
      jobId: input.jobId,
      userId: input.userId,
      objectKey: input.objectKey,
      source: input.source,
    });
  }

  private async processCleanupAvatarUpload(job: Job<CleanupAvatarUploadJob>) {
    this.logger.log({
      message: 'Avatar upload cleanup started',
      jobId: job.id,
      uploadId: job.data.uploadId,
      userId: job.data.userId,
      objectKey: job.data.objectKey,
    });

    await this.cacheService.withLock({
      key: `lock:users:cleanup-avatar-upload:${job.data.uploadId}`,
      ttlSeconds: 5 * 60,
      waitTimeoutMs: 1000,
      callback: async () => {
        const upload = await this.usersMediaRepository.findAvatarUploadById(
          job.data.uploadId,
        );

        if (!upload) {
          this.logger.log({
            message: 'Avatar upload cleanup skipped',
            reason: 'upload_not_found',
            jobId: job.id,
            uploadId: job.data.uploadId,
            userId: job.data.userId,
            objectKey: job.data.objectKey,
          });

          return;
        }

        if (upload.status === USER_AVATAR_UPLOAD_STATUS.confirmed) {
          this.logger.log({
            message: 'Avatar upload cleanup skipped',
            reason: 'upload_confirmed',
            jobId: job.id,
            uploadId: upload.id,
            userId: upload.userId,
            objectKey: upload.objectKey,
          });

          return;
        }

        if (
          upload.status === USER_AVATAR_UPLOAD_STATUS.cleanedUp ||
          upload.status === USER_AVATAR_UPLOAD_STATUS.expired
        ) {
          this.logger.log({
            message: 'Avatar upload cleanup skipped',
            reason: 'upload_already_processed',
            jobId: job.id,
            uploadId: upload.id,
            userId: upload.userId,
            objectKey: upload.objectKey,
            status: upload.status,
          });

          return;
        }

        if (
          upload.userId !== job.data.userId ||
          upload.objectKey !== job.data.objectKey
        ) {
          this.logger.warn({
            message: 'Avatar upload cleanup skipped',
            reason: 'job_upload_mismatch',
            jobId: job.id,
            uploadId: upload.id,
            jobUserId: job.data.userId,
            uploadUserId: upload.userId,
            jobObjectKey: job.data.objectKey,
            uploadObjectKey: upload.objectKey,
          });

          return;
        }

        await this.deleteAvatarObject({
          jobId: job.id,
          userId: upload.userId,
          objectKey: upload.objectKey,
          source: USER_JOBS.cleanupAvatarUpload,
        });

        await this.usersMediaRepository.markAvatarUploadCleanedUp(upload.id);

        this.logger.log({
          message: 'Avatar upload cleanup completed',
          jobId: job.id,
          uploadId: upload.id,
          userId: upload.userId,
          objectKey: upload.objectKey,
        });
      },
    });
  }

  private async cleanupFriendships(job: Job<DeletedUserCleanupJob>) {
    this.logger.log({
      message: 'Deleted user cleanup stage skipped',
      stage: 'cleanup_friendships',
      reason: 'handled_by_database_cascade_or_domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async cleanupNotifications(job: Job<DeletedUserCleanupJob>) {
    this.logger.log({
      message: 'Deleted user cleanup stage skipped',
      stage: 'cleanup_notifications',
      reason: 'domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async cleanupDevices(job: Job<DeletedUserCleanupJob>) {
    this.logger.log({
      message: 'Deleted user cleanup stage skipped',
      stage: 'cleanup_devices',
      reason: 'domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async archiveAnalytics(job: Job<DeletedUserCleanupJob>) {
    this.logger.log({
      message: 'Deleted user cleanup stage skipped',
      stage: 'archive_analytics',
      reason: 'domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async sendAccountDeletedEmail(job: Job<DeletedUserCleanupJob>) {
    await this.mailQueueService.enqueueAccountDeletedEmail({
      userId: job.data.userId,
      email: job.data.email,
      username: job.data.username,
    });

    this.logger.log({
      message: 'Deleted user cleanup stage completed',
      stage: 'send_account_deleted_email',
      jobId: job.id,
      userId: job.data.userId,
    });
  }
}

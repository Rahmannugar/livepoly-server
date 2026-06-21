import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CacheService } from '../../infra/cache/cache.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { QUEUES, USER_JOBS } from '../../infra/queue/queue.constants';
import { StorageService } from '../../infra/storage/storage.service';
import { MailQueueService } from '../../mail/jobs/mail-queue.service';
import { UsersMediaRepository } from '../repositories/users-media.repository';
import {
  USER_AVATAR,
  USER_AVATAR_UPLOAD_STATUS,
  USER_EVENTS,
  USER_METRICS,
} from '../users.constants';
import type { UserAvatarContentType } from '../users.constants';
import type {
  DeleteAvatarJob,
  DeletedUserCleanupJob,
  VerifyAvatarUploadJob,
} from './users-jobs.types';

type UsersJob = DeletedUserCleanupJob | DeleteAvatarJob | VerifyAvatarUploadJob;

@Processor(QUEUES.users)
export class UsersProcessor extends WorkerHost {
  constructor(
    private readonly mailQueueService: MailQueueService,
    private readonly cacheService: CacheService,
    private readonly storageService: StorageService,
    private readonly usersMediaRepository: UsersMediaRepository,
    private readonly observabilityService: ObservabilityService,
  ) {
    super();
  }

  async process(job: Job<UsersJob>) {
    if (job.name === USER_JOBS.cleanupDeletedUser) {
      await this.processDeletedUserCleanup(job as Job<DeletedUserCleanupJob>);
      return;
    }

    if (job.name === USER_JOBS.deleteAvatar) {
      await this.processDeleteAvatar(job as Job<DeleteAvatarJob>);
      return;
    }

    if (job.name === USER_JOBS.verifyAvatarUpload) {
      await this.processVerifyAvatarUpload(job as Job<VerifyAvatarUploadJob>);
      return;
    }

    this.observabilityService.recordEvent(USER_EVENTS.unknownJobReceived, {
      jobId: job.id,
      jobName: job.name,
    });
    this.observabilityService.recordMetric(USER_METRICS.unknownJobReceived);
  }

  private async processDeletedUserCleanup(job: Job<DeletedUserCleanupJob>) {
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

        this.cleanupFriendships(job);
        this.cleanupNotifications(job);
        this.cleanupDevices(job);
        this.archiveAnalytics(job);
        await this.sendAccountDeletedEmail(job);
      },
    });

    this.recordJobCompleted({
      jobName: job.name,
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async processDeleteAvatar(job: Job<DeleteAvatarJob>) {
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

    this.recordJobCompleted({
      jobName: job.name,
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private async processVerifyAvatarUpload(job: Job<VerifyAvatarUploadJob>) {
    await this.cacheService.withLock({
      key: `lock:users:verify-avatar-upload:${job.data.uploadId}`,
      ttlSeconds: 5 * 60,
      waitTimeoutMs: 1000,
      callback: async () => {
        const upload = await this.usersMediaRepository.findAvatarUploadById(
          job.data.uploadId,
        );

        if (!upload) {
          this.recordJobSkipped({
            jobName: job.name,
            reason: 'upload_not_found',
            jobId: job.id,
            uploadId: job.data.uploadId,
            userId: job.data.userId,
            objectKey: job.data.objectKey,
          });

          return;
        }

        if (upload.status === USER_AVATAR_UPLOAD_STATUS.confirmed) {
          this.recordJobSkipped({
            jobName: job.name,
            reason: 'upload_already_confirmed',
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
          this.recordJobSkipped({
            jobName: job.name,
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
          this.recordJobSkipped({
            jobName: job.name,
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

        const metadata = await this.storageService.getObjectMetadata(
          upload.objectKey,
        );

        if (!metadata) {
          await this.usersMediaRepository.restoreAvatarObjectKey(
            upload.userId,
            upload.objectKey,
            upload.previousAvatarObjectKey,
          );

          await this.usersMediaRepository.markAvatarUploadExpired(upload.id);

          this.recordJobSkipped({
            jobName: job.name,
            reason: 'object_not_found',
            jobId: job.id,
            uploadId: upload.id,
            userId: upload.userId,
            objectKey: upload.objectKey,
          });

          return;
        }

        const contentType = metadata.contentType;

        if (
          metadata.contentLength !== upload.contentLength ||
          contentType !== upload.contentType ||
          !this.isAllowedAvatarContentType(contentType) ||
          !this.contentTypeMatchesObjectKey(upload.objectKey, contentType)
        ) {
          await this.deleteInvalidAvatarUpload(upload, job, 'invalid_metadata');
          return;
        }

        const headerBytes = await this.storageService.getObjectBytes(
          upload.objectKey,
          'bytes=0-15',
        );

        if (!this.fileSignatureMatchesContentType(headerBytes, contentType)) {
          await this.deleteInvalidAvatarUpload(
            upload,
            job,
            'invalid_signature',
          );
          return;
        }

        const confirmedUpload =
          await this.usersMediaRepository.confirmAvatarUpload(upload.id);

        if (!confirmedUpload) {
          this.recordJobSkipped({
            jobName: job.name,
            reason: 'upload_status_changed',
            jobId: job.id,
            uploadId: upload.id,
            userId: upload.userId,
            objectKey: upload.objectKey,
          });

          return;
        }

        if (
          upload.previousAvatarObjectKey &&
          upload.previousAvatarObjectKey !== upload.objectKey
        ) {
          await this.deleteAvatarObject({
            jobId: job.id,
            userId: upload.userId,
            objectKey: upload.previousAvatarObjectKey,
            source: USER_JOBS.verifyAvatarUpload,
          });
        }

        this.recordJobCompleted({
          jobName: job.name,
          jobId: job.id,
          uploadId: upload.id,
          userId: upload.userId,
          objectKey: upload.objectKey,
        });
      },
    });
  }

  private async deleteInvalidAvatarUpload(
    upload: {
      id: string;
      userId: string;
      objectKey: string;
      previousAvatarObjectKey: string | null;
    },
    job: Job<VerifyAvatarUploadJob>,
    reason: string,
  ) {
    await this.deleteAvatarObject({
      jobId: job.id,
      userId: upload.userId,
      objectKey: upload.objectKey,
      source: USER_JOBS.verifyAvatarUpload,
    });

    await this.usersMediaRepository.restoreAvatarObjectKey(
      upload.userId,
      upload.objectKey,
      upload.previousAvatarObjectKey,
    );

    await this.usersMediaRepository.markAvatarUploadCleanedUp(upload.id);

    this.recordJobSkipped({
      jobName: job.name,
      reason,
      jobId: job.id,
      uploadId: upload.id,
      userId: upload.userId,
      objectKey: upload.objectKey,
    });
  }

  private async deleteAvatarObject(input: {
    jobId?: string;
    userId: string;
    objectKey: string | null;
    source: string;
  }) {
    if (!input.objectKey) {
      this.recordJobSkipped({
        jobName: input.source,
        reason: 'no_avatar',
        jobId: input.jobId,
        userId: input.userId,
        source: input.source,
      });

      return;
    }

    await this.storageService.deleteObject(input.objectKey);

    this.recordJobCompleted({
      jobName: input.source,
      jobId: input.jobId,
      userId: input.userId,
      objectKey: input.objectKey,
      source: input.source,
    });
  }

  private isAllowedAvatarContentType(
    contentType: string | null,
  ): contentType is UserAvatarContentType {
    return USER_AVATAR.allowedContentTypes.includes(
      contentType as UserAvatarContentType,
    );
  }

  private contentTypeMatchesObjectKey(
    objectKey: string,
    contentType: string | null,
  ) {
    if (contentType === 'image/jpeg') return objectKey.endsWith('.jpg');
    if (contentType === 'image/png') return objectKey.endsWith('.png');
    if (contentType === 'image/webp') return objectKey.endsWith('.webp');

    return false;
  }

  private fileSignatureMatchesContentType(
    bytes: Uint8Array | null,
    contentType: UserAvatarContentType,
  ) {
    if (!bytes) return false;

    if (contentType === 'image/jpeg') {
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    }

    if (contentType === 'image/png') {
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    }

    if (contentType === 'image/webp') {
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    }

    return false;
  }

  private cleanupFriendships(job: Job<DeletedUserCleanupJob>): void {
    this.recordJobSkipped({
      jobName: job.name,
      stage: 'cleanup_friendships',
      reason: 'handled_by_database_cascade_or_domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private cleanupNotifications(job: Job<DeletedUserCleanupJob>): void {
    this.recordJobSkipped({
      jobName: job.name,
      stage: 'cleanup_notifications',
      reason: 'domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private cleanupDevices(job: Job<DeletedUserCleanupJob>): void {
    this.recordJobSkipped({
      jobName: job.name,
      stage: 'cleanup_devices',
      reason: 'domain_not_connected',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private archiveAnalytics(job: Job<DeletedUserCleanupJob>): void {
    this.recordJobSkipped({
      jobName: job.name,
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

    this.recordJobCompleted({
      jobName: job.name,
      stage: 'send_account_deleted_email',
      jobId: job.id,
      userId: job.data.userId,
    });
  }

  private recordJobCompleted(
    attributes: Record<string, string | number | boolean | null | undefined>,
  ): void {
    this.observabilityService.recordEvent(USER_EVENTS.jobCompleted, attributes);
    this.observabilityService.recordMetric(USER_METRICS.jobCompleted);
  }

  private recordJobSkipped(
    attributes: Record<string, string | number | boolean | null | undefined>,
  ): void {
    this.observabilityService.recordEvent(USER_EVENTS.jobSkipped, attributes);
    this.observabilityService.recordMetric(USER_METRICS.jobSkipped);
  }
}

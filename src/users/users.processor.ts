import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES, USER_JOBS } from '../infra/queue/queue.constants';
import type { DeletedUserCleanupJob } from './users-queue.service';
import { MailQueueService } from '../mail/mail-queue.service';

@Processor(QUEUES.users)
export class UsersProcessor extends WorkerHost {
  constructor(private readonly mailQueueService: MailQueueService) {
    super();
  }
  private readonly logger = new Logger(UsersProcessor.name);

  async process(job: Job<DeletedUserCleanupJob>) {
    if (job.name !== USER_JOBS.cleanupDeletedUser) {
      this.logger.warn({
        message: 'Unknown users job received',
        jobId: job.id,
        jobName: job.name,
      });

      return;
    }

    this.logger.log({
      message: 'Deleted user cleanup started',
      jobId: job.id,
      userId: job.data.userId,
      username: job.data.username,
    });

    await this.deleteAvatar(job);
    await this.cleanupFriendships(job);
    await this.cleanupNotifications(job);
    await this.cleanupDevices(job);
    await this.archiveAnalytics(job);
    await this.sendAccountDeletedEmail(job);

    this.logger.log({
      message: 'Deleted user cleanup completed',
      jobId: job.id,
      userId: job.data.userId,
      username: job.data.username,
    });
  }

  private async deleteAvatar(job: Job<DeletedUserCleanupJob>) {
    if (!job.data.avatarObjectKey) {
      this.logger.log({
        message: 'Deleted user cleanup stage skipped',
        stage: 'delete_avatar',
        reason: 'no_avatar',
        jobId: job.id,
        userId: job.data.userId,
      });

      return;
    }

    this.logger.log({
      message: 'Deleted user cleanup stage pending',
      stage: 'delete_avatar',
      reason: 'storage_client_not_connected',
      jobId: job.id,
      userId: job.data.userId,
      avatarObjectKey: job.data.avatarObjectKey,
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

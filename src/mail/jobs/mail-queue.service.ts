import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAIL_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import type { SendOtpMailJob } from './mail-jobs.types';
import { JobsService } from '../../jobs/jobs.service';
import { JOB_TYPES } from '../../jobs/job.types';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(QUEUES.mail) private readonly mailQueue: Queue,
    private readonly jobsService: JobsService,
  ) {}

  async enqueueEmailVerificationOtp(input: SendOtpMailJob) {
    await this.mailQueue.add(
      MAIL_JOBS.sendEmailVerificationOtp,
      {
        email: input.email,
        otpCode: input.otpCode,
      },
      {
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 5_000 }),
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async enqueuePasswordResetOtp(input: SendOtpMailJob) {
    await this.mailQueue.add(
      MAIL_JOBS.sendPasswordResetOtp,
      {
        email: input.email,
        otpCode: input.otpCode,
      },
      {
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 5_000 }),
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async enqueueAccountDeletedEmail(input: {
    userId: string;
    email: string;
    username: string;
  }) {
    const job = await this.jobsService.createOrGet({
      key: `mail:account-deleted-email:${input.userId}`,
      type: JOB_TYPES.accountDeletedEmail,
      payload: {
        userId: input.userId,
        email: input.email,
        username: input.username,
      },
      maxAttempts: 3,
    });

    await this.mailQueue.add(
      MAIL_JOBS.sendAccountDeletedEmail,
      {
        jobId: job.id,
        userId: input.userId,
        email: input.email,
        username: input.username,
      },
      {
        jobId: job.id,
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 5_000 }),
        removeOnComplete: {
          age: 7 * 24 * 60 * 60,
          count: 1000,
        },
        removeOnFail: 100,
      },
    );
  }
}

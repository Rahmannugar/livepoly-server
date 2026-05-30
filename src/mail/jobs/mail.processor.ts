import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { MAIL_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { MailService } from '../mail.service';
import type { MailJob } from './mail-jobs.types';
import { JobsService } from '../../jobs/jobs.service';
import { MAIL_EVENTS, MAIL_METRICS } from '../mail.constants';

@Processor(QUEUES.mail)
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly mailService: MailService,
    private readonly jobsService: JobsService,
    private readonly observabilityService: ObservabilityService,
  ) {
    super();
  }

  async process(job: Job<MailJob>) {
    if (job.name === MAIL_JOBS.sendEmailVerificationOtp) {
      if (!('otpCode' in job.data)) {
        throw new Error('Invalid email verification OTP job payload');
      }

      await this.mailService.sendEmailVerificationOtp(
        job.data.email,
        job.data.otpCode,
      );

      this.recordJobCompleted({
        jobId: job.id,
        jobName: job.name,
      });

      return;
    }

    if (job.name === MAIL_JOBS.sendPasswordResetOtp) {
      if (!('otpCode' in job.data)) {
        throw new Error('Invalid password reset OTP job payload');
      }

      await this.mailService.sendPasswordResetOtp(
        job.data.email,
        job.data.otpCode,
      );

      this.recordJobCompleted({
        jobId: job.id,
        jobName: job.name,
      });

      return;
    }

    if (job.name === MAIL_JOBS.sendAccountDeletedEmail) {
      if (!('username' in job.data) || !('jobId' in job.data)) {
        throw new Error('Invalid account deleted email job payload');
      }

      const startResult = await this.jobsService.start(job.data.jobId);

      if (startResult.status !== 'started') {
        this.recordJobSkipped({
          jobId: job.id,
          jobName: job.name,
          trackedJobId: job.data.jobId,
          reason: startResult.status,
        });

        return;
      }

      try {
        await this.mailService.sendAccountDeletedEmail(
          job.data.email,
          job.data.username,
        );

        await this.jobsService.complete(job.data.jobId);

        this.recordJobCompleted({
          jobId: job.id,
          trackedJobId: job.data.jobId,
          jobName: job.name,
        });
      } catch (error) {
        await this.jobsService.fail(job.data.jobId, error);
        throw error;
      }
      return;
    }

    this.observabilityService.recordEvent(MAIL_EVENTS.unknownJobReceived, {
      jobId: job.id,
      jobName: job.name,
    });
    this.observabilityService.recordMetric(MAIL_METRICS.unknownJobReceived);
  }

  private recordJobCompleted(input: {
    jobId?: string;
    jobName: string;
    trackedJobId?: string;
  }): void {
    this.observabilityService.recordEvent(MAIL_EVENTS.jobCompleted, input);
    this.observabilityService.recordMetric(MAIL_METRICS.jobCompleted);
  }

  private recordJobSkipped(input: {
    jobId?: string;
    jobName: string;
    trackedJobId?: string;
    reason: string;
  }): void {
    this.observabilityService.recordEvent(MAIL_EVENTS.jobSkipped, input);
    this.observabilityService.recordMetric(MAIL_METRICS.jobSkipped);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MAIL_JOBS, QUEUES } from '../infra/queue/queue.constants';
import { MailService } from './mail.service';

type MailJob =
  | {
      email: string;
      otpCode: string;
    }
  | {
      email: string;
      username: string;
    };

@Processor(QUEUES.mail)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<MailJob>) {
    this.logger.log({
      message: 'Mail job started',
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
    });

    if (job.name === MAIL_JOBS.sendEmailVerificationOtp) {
      if (!('otpCode' in job.data)) {
        throw new Error('Invalid email verification OTP job payload');
      }

      await this.mailService.sendEmailVerificationOtp(
        job.data.email,
        job.data.otpCode,
      );

      this.logger.log({
        message: 'Email verification OTP sent',
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

      this.logger.log({
        message: 'Password reset OTP sent',
        jobId: job.id,
        jobName: job.name,
      });

      return;
    }

    if (job.name === MAIL_JOBS.sendAccountDeletedEmail) {
      if (!('username' in job.data)) {
        throw new Error('Invalid account deleted email job payload');
      }

      await this.mailService.sendAccountDeletedEmail(
        job.data.email,
        job.data.username,
      );

      this.logger.log({
        message: 'Account deleted email sent',
        jobId: job.id,
        jobName: job.name,
      });

      return;
    }

    this.logger.warn({
      message: 'Unknown mail job received',
      jobId: job.id,
      jobName: job.name,
    });
  }
}

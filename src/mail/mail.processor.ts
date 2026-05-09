import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MAIL_JOBS, QUEUES } from '../queue/queue.constants';
import { MailService } from './mail.service';

type MailJob = {
  email: string;
  otpCode: string;
};

@Processor(QUEUES.mail)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<MailJob>) {
    if (job.name === MAIL_JOBS.sendEmailVerificationOtp) {
      await this.mailService.sendEmailVerificationOtp(
        job.data.email,
        job.data.otpCode,
      );
      return;
    }

    if (job.name === MAIL_JOBS.sendPasswordResetOtp) {
      await this.mailService.sendPasswordResetOtp(
        job.data.email,
        job.data.otpCode,
      );
      return;
    }

    this.logger.warn(`Unknown mail job received: ${job.name}`);
  }
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAIL_JOBS, QUEUES } from '../infra/queue/queue.constants';

type SendOtpInput = {
  email: string;
  otpCode: string;
};

@Injectable()
export class MailQueueService {
  constructor(@InjectQueue(QUEUES.mail) private readonly mailQueue: Queue) {}

  async enqueueEmailVerificationOtp(input: SendOtpInput) {
    await this.mailQueue.add(
      MAIL_JOBS.sendEmailVerificationOtp,
      {
        email: input.email,
        otpCode: input.otpCode,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async enqueuePasswordResetOtp(input: SendOtpInput) {
    await this.mailQueue.add(
      MAIL_JOBS.sendPasswordResetOtp,
      {
        email: input.email,
        otpCode: input.otpCode,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}

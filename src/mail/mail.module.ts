import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../infra/queue/queue.constants';
import { JobsModule } from '../jobs/jobs.module';
import { MailQueueService } from './jobs/mail-queue.service';
import { MAIL_CLIENT } from './mail.types';
import { MailService } from './mail.service';
import { NodemailerMailClient } from './nodemailer-mail.client';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.mail }), JobsModule],
  providers: [
    NodemailerMailClient,
    {
      provide: MAIL_CLIENT,
      useExisting: NodemailerMailClient,
    },
    MailService,
    MailQueueService,
  ],
  exports: [MailService, MailQueueService, BullModule],
})
export class MailModule {}

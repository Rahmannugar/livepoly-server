import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../infra/queue/queue.constants';
import { MailQueueService } from './jobs/mail-queue.service';
import { MailService } from './mail.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.mail }), JobsModule],
  providers: [MailService, MailQueueService],
  exports: [MailService, MailQueueService, BullModule],
})
export class MailModule {}

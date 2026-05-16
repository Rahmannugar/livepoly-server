import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../infra/queue/queue.constants';
import { MailQueueService } from './jobs/mail-queue.service';
import { MailService } from './mail.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.mail })],
  providers: [MailService, MailQueueService],
  exports: [MailService, MailQueueService, BullModule],
})
export class MailModule {}

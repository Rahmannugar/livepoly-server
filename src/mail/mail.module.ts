import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../infra/queue/queue.constants';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.mail })],
  providers: [MailService, MailQueueService],
  exports: [MailService, MailQueueService, BullModule],
})
export class MailModule {}

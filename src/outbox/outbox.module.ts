import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infra/database/database.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { OutboxQueueService } from './jobs/outbox-queue.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule, BullModule.registerQueue({ name: QUEUES.outbox })],
  providers: [OutboxService, OutboxRepository, OutboxQueueService],
  exports: [OutboxService, OutboxQueueService],
})
export class OutboxModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PubSubModule } from '../../infra/pubsub/pubsub.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { OutboxModule } from '../outbox.module';
import { OutboxPublisher } from '../outbox.publisher';
import { OutboxProcessor } from './outbox.processor';
import { OutboxRecoveryService } from './outbox-recovery.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.outbox }),
    OutboxModule,
    PubSubModule,
  ],
  providers: [OutboxPublisher, OutboxProcessor, OutboxRecoveryService],
})
export class OutboxWorkerModule {}

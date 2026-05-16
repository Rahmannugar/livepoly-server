import { Module } from '@nestjs/common';
import { PubSubModule } from '../infra/pubsub/pubsub.module';
import { OutboxModule } from './outbox.module';
import { OutboxPublisher } from './outbox.publisher';

@Module({
  imports: [OutboxModule, PubSubModule],
  providers: [OutboxPublisher],
})
export class OutboxWorkerModule {}

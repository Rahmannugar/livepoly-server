import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '../../infra/cache/cache.module';
import { DatabaseModule } from '../../infra/database/database.module';
import { ObservabilityModule } from '../../infra/observability/observability.module';
import { PubSubModule } from '../../infra/pubsub/pubsub.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import { RoomsExpiryService } from '../services/rooms-expiry.service';
import { RoomsStreamService } from '../services/rooms-stream.service';
import { RoomsExpiryScheduler } from './rooms-expiry-scheduler.service';
import { RoomsProcessor } from './rooms.processor';
import { RoomsQueueService } from './rooms-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.rooms }),
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    PubSubModule,
  ],
  providers: [
    RoomsExpiryScheduler,
    RoomsProcessor,
    RoomsQueueService,
    RoomsExpiryService,
    RoomsStreamService,
    RoomsLobbyRepository,
  ],
})
export class RoomsWorkerModule {}

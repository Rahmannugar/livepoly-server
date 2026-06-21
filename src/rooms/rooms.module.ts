import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { GameModule } from '../game/game.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { PubSubModule } from '../infra/pubsub/pubsub.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { RoomsGameRepository } from './repositories/rooms-game.repository';
import { RoomsLobbyRepository } from './repositories/rooms-lobby.repository';
import { RoomsController } from './rooms.controller';
import { RoomsGameService } from './services/rooms-game.service';
import { RoomsExpiryService } from './services/rooms-expiry.service';
import { RoomsLobbyService } from './services/rooms-lobby.service';
import { RoomsStreamService } from './services/rooms-stream.service';
import { QUEUES } from '../infra/queue/queue.constants';
import { RoomsQueueService } from './jobs/rooms-queue.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    RateLimitModule,
    NotificationsModule,
    OutboxModule,
    GameModule,
    ObservabilityModule,
    PubSubModule,
    BullModule.registerQueue({ name: QUEUES.rooms }),
  ],
  controllers: [RoomsController],
  providers: [
    RoomsLobbyService,
    RoomsGameService,
    RoomsExpiryService,
    RoomsStreamService,
    RoomsLobbyRepository,
    RoomsGameRepository,
    RoomsQueueService,
  ],
})
export class RoomsModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { PubSubModule } from '../infra/pubsub/pubsub.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { GameBotQueueService } from './bots/game-bot-queue.service';
import { GameBotService } from './bots/game-bot.service';
import { GameCommandsService } from './commands/game-commands.service';
import { GameAccessRepository } from './realtime/game-access.repository';
import { GameRealtimePublisher } from './realtime/game-realtime.publisher';
import { GameGateway } from './realtime/game.gateway';
import { GameStateService } from './state/game-state.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.game }),
    AuthModule,
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    PubSubModule,
  ],
  providers: [
    GameStateService,
    GameCommandsService,
    GameAccessRepository,
    GameRealtimePublisher,
    GameBotService,
    GameBotQueueService,
    GameGateway,
  ],
  exports: [GameStateService, GameCommandsService, GameBotQueueService],
})
export class GameModule {}

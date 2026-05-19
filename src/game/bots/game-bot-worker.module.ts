import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../infra/cache/cache.module';
import { DatabaseModule } from '../../infra/database/database.module';
import { ObservabilityModule } from '../../infra/observability/observability.module';
import { PubSubModule } from '../../infra/pubsub/pubsub.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { GameCommandsService } from '../commands/game-commands.service';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameStateService } from '../state/game-state.service';
import { GameBotProcessor } from './game-bot.processor';
import { GameBotQueueService } from './game-bot-queue.service';
import { GameBotService } from './game-bot.service';

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
    GameRealtimePublisher,
    GameBotService,
    GameBotQueueService,
    GameBotProcessor,
  ],
})
export class GameBotWorkerModule {}

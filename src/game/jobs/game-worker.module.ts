import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { CacheModule } from '../../infra/cache/cache.module';
import { DatabaseModule } from '../../infra/database/database.module';
import { ObservabilityModule } from '../../infra/observability/observability.module';
import { PubSubModule } from '../../infra/pubsub/pubsub.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import { GameBotService } from '../bots/game-bot.service';
import { GameCommandsService } from '../commands/game-commands.service';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import { GameSnapshotRepository } from '../snapshots/game-snapshots.repository';
import { GameSnapshotService } from '../snapshots/game-snapshots.service';
import { GameStateService } from '../state/game-state.service';
import { GameTurnTimerPolicyService } from '../timers/game-turn-timer-policy.service';
import { GameTurnTimerQueueService } from '../timers/game-turn-timer-queue.service';
import { GameProcessor } from './game.processor';

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
    GameTurnTimerPolicyService,
    GameTurnTimerQueueService,
    GameSnapshotRepository,
    GameSnapshotService,
    GameRecoveryService,
    GameProcessor,
  ],
})
export class GameWorkerModule {}

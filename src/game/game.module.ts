import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { RealtimeModule } from '../infra/realtime/realtime.module';
import { GameBotQueueService } from './bots/game-bot-queue.service';
import { GameBotService } from './bots/game-bot.service';
import { GameCommandsService } from './commands/game-commands.service';
import { GameAccessRepository } from './realtime/game-access.repository';
import { GameRealtimePublisher } from './realtime/game-realtime.publisher';
import { GameRealtimeService } from './realtime/game-realtime.service';
import { GameGateway } from './realtime/game.gateway';
import { GameRecoveryService } from './recovery/game-recovery.service';
import { GameResultsRepository } from './results/game-results.repository';
import { GameResultsService } from './results/game-results.service';
import { GameSnapshotRepository } from './snapshots/game-snapshots.repository';
import { GameSnapshotService } from './snapshots/game-snapshots.service';
import { GameStateService } from './state/game-state.service';
import { GameTurnTimerQueueService } from './timers/game-turn-timer-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.game }),
    AuthModule,
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    RealtimeModule,
  ],
  providers: [
    GameStateService,
    GameCommandsService,
    GameAccessRepository,
    GameRealtimePublisher,
    GameRealtimeService,
    GameBotService,
    GameBotQueueService,
    GameTurnTimerQueueService,
    GameSnapshotRepository,
    GameSnapshotService,
    GameRecoveryService,
    GameResultsRepository,
    GameResultsService,
    GameGateway,
  ],
  exports: [
    GameStateService,
    GameCommandsService,
    GameBotQueueService,
    GameTurnTimerQueueService,
    GameSnapshotService,
    GameRecoveryService,
    GameResultsService,
  ],
})
export class GameModule {}

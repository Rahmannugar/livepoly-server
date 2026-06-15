import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../infra/cache/cache.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { RealtimeModule } from '../infra/realtime/realtime.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
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
import { GameRatingService } from './stats/game-rating.service';
import { GameStatsRepository } from './stats/game-stats.repository';
import { GameStatsService } from './stats/game-stats.service';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { UsersModule } from '../users/users.module';
import { GameEventsRepository } from './events/game-events.repository';
import { GameEventsService } from './events/game-events.service';
import { GamePresenceService } from './presence/game-presence.service';
import { GameController } from './game.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.game }),
    AuthModule,
    CacheModule,
    DatabaseModule,
    ObservabilityModule,
    RateLimitModule,
    RealtimeModule,
    LeaderboardsModule,
    UsersModule,
  ],
  controllers: [GameController],
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
    GameRatingService,
    GameStatsRepository,
    GameStatsService,
    GameEventsRepository,
    GameEventsService,
    GamePresenceService,
  ],
  exports: [
    GameStateService,
    GameCommandsService,
    GameBotQueueService,
    GameTurnTimerQueueService,
    GameSnapshotService,
    GameRecoveryService,
    GameResultsService,
    GameRealtimePublisher,
  ],
})
export class GameModule {}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import { GameBotService } from '../bots/game-bot.service';
import type { ExecuteBotTurnJob } from '../bots/game-bot.types';
import type { GameCommandResult } from '../commands/game-commands.types';
import { GameCommandsService } from '../commands/game-commands.service';
import type { GameEngineIntent } from '../engine/game-engine-intents';
import {
  GameEngineError,
  type GameEngineState,
} from '../engine/game-engine.types';
import {
  GAME_JOBS,
  LEADERBOARD_JOBS,
  QUEUES,
} from '../../infra/queue/queue.constants';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameRecoveryService } from '../recovery/game-recovery.service';
import { GameTurnTimerPolicyService } from '../timers/game-turn-timer-policy.service';
import { GameTurnTimerQueueService } from '../timers/game-turn-timer-queue.service';
import type {
  ExecuteTurnTimeoutJob,
  FinishExpiredGameJob,
} from '../timers/game-turn-timer.types';
import type { GameJob } from './game-jobs.types';
import { LeaderboardsService } from '../../leaderboards/leaderboards.service';
import type { RefreshLeaderboardSnapshotsJob } from '../../leaderboards/leaderboards.types';
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';

@Processor(QUEUES.game)
export class GameProcessor extends WorkerHost {
  constructor(
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly gameBotService: GameBotService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
    private readonly gameTurnTimerPolicyService: GameTurnTimerPolicyService,
    private readonly observabilityService: ObservabilityService,
    private readonly leaderboardsService: LeaderboardsService,
  ) {
    super();
  }

  async process(job: Job<GameJob>) {
    if (job.name === GAME_JOBS.executeBotTurn) {
      await this.processExecuteBotTurn(job as Job<ExecuteBotTurnJob>);
      return;
    }

    if (job.name === GAME_JOBS.executeTurnTimeout) {
      await this.processExecuteTurnTimeout(job as Job<ExecuteTurnTimeoutJob>);
      return;
    }

    if (job.name === GAME_JOBS.finishExpiredGame) {
      await this.processFinishExpiredGame(job as Job<FinishExpiredGameJob>);
      return;
    }

    if (job.name === LEADERBOARD_JOBS.refreshSnapshots) {
      await this.processRefreshLeaderboards(
        job as Job<RefreshLeaderboardSnapshotsJob>,
      );
      return;
    }

    this.observabilityService.recordEvent(GAME_EVENTS.unknownJobReceived, {
      jobId: job.id,
      jobName: job.name,
    });
    this.observabilityService.recordMetric(GAME_METRICS.unknownJobReceived);
  }

  private async processExecuteBotTurn(job: Job<ExecuteBotTurnJob>) {
    const state = await this.gameRecoveryService.getOrRecover(job.data.gameId);
    const decision = this.gameBotService.chooseDecision(state);

    if (!decision) {
      this.observabilityService.recordEvent(GAME_EVENTS.botTurnSkipped, {
        jobId: job.id,
        gameId: job.data.gameId,
        phase: state.phase,
        turnNumber: state.turnNumber,
      });
      return;
    }

    try {
      const result = await this.gameCommandsService.executeIntent({
        gameId: job.data.gameId,
        roomPlayerId: decision.roomPlayerId,
        source: 'bot',
        intent: decision.intent,
      });

      await this.afterAutomatedCommand(job.data.gameId, result.state, result);

      this.observabilityService.recordEvent(GAME_EVENTS.botTurnExecuted, {
        jobId: job.id,
        gameId: job.data.gameId,
        roomPlayerId: decision.roomPlayerId,
        intentType: decision.intent.type,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
      });

      this.observabilityService.recordMetric(GAME_METRICS.botTurnExecuted);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.botTurnFailed, {
        jobId: job.id,
        gameId: job.data.gameId,
        roomPlayerId: decision.roomPlayerId,
        intentType: decision.intent.type,
        errorCode: error instanceof GameEngineError ? error.code : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.botTurnFailed);

      throw error;
    }
  }

  private async processExecuteTurnTimeout(job: Job<ExecuteTurnTimeoutJob>) {
    const state = await this.gameRecoveryService.getOrRecover(job.data.gameId);

    if (!this.isTimerJobCurrent(job.data, state)) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
        jobId: job.id,
        ...job.data,
        currentPhase: state.phase,
        currentTurnNumber: state.turnNumber,
        currentTurnRoomPlayerId: state.currentTurnRoomPlayerId,
        currentActionStateKey: this.getActionStateKey(state),
      });
      return;
    }

    const intent = this.gameTurnTimerPolicyService.chooseTimeoutIntent(state);

    if (!intent) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
        jobId: job.id,
        ...job.data,
        reason: 'no_timeout_intent',
      });
      return;
    }

    try {
      const result = await this.gameCommandsService.executeIntent({
        gameId: job.data.gameId,
        roomPlayerId: this.getIntentRoomPlayerId(intent),
        source: 'timer',
        intent,
      });

      await this.afterAutomatedCommand(job.data.gameId, result.state, result);

      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerExecuted, {
        jobId: job.id,
        gameId: job.data.gameId,
        intentType: intent.type,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerExecuted);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerFailed, {
        jobId: job.id,
        gameId: job.data.gameId,
        intentType: intent.type,
        errorCode: error instanceof GameEngineError ? error.code : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerFailed);

      throw error;
    }
  }

  private async processFinishExpiredGame(job: Job<FinishExpiredGameJob>) {
    const state = await this.gameRecoveryService.getOrRecover(job.data.gameId);

    if (state.phase === 'finished' || state.phase === 'cancelled') {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
        jobId: job.id,
        gameId: job.data.gameId,
        reason: 'game_already_closed',
      });
      return;
    }

    const now = Date.now();
    const expiresAt = state.expiresAt ?? job.data.expiresAt;

    if (now < expiresAt) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
        jobId: job.id,
        gameId: job.data.gameId,
        reason: 'game_not_expired',
        expiresAt,
        now,
      });

      throw new Error('Game expiry job ran before the game expired');
    }

    try {
      const result = await this.gameCommandsService.executeIntent({
        gameId: job.data.gameId,
        source: 'timer',
        intent: {
          type: 'finish_game_by_time',
          payload: {
            finishedAt: now,
          },
        },
      });

      await this.gameRealtimePublisher.publishCommandResult(
        job.data.gameId,
        result,
      );

      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerExecuted, {
        jobId: job.id,
        gameId: job.data.gameId,
        intentType: 'finish_game_by_time',
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerExecuted);
    } catch (error) {
      if (
        error instanceof GameEngineError &&
        error.code === 'GAME_NOT_ACTIVE'
      ) {
        this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
          jobId: job.id,
          gameId: job.data.gameId,
          reason: 'game_already_closed',
        });
        return;
      }

      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerFailed, {
        jobId: job.id,
        gameId: job.data.gameId,
        intentType: 'finish_game_by_time',
        errorCode: error instanceof GameEngineError ? error.code : undefined,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerFailed);

      throw error;
    }
  }

  private async afterAutomatedCommand(
    gameId: string,
    state: GameEngineState,
    result: GameCommandResult,
  ): Promise<void> {
    await this.gameRealtimePublisher.publishCommandResult(gameId, result);
    await this.gameBotQueueService.enqueueIfBotCanAct(gameId, state);
    await this.gameTurnTimerQueueService.enqueueTurnTimer(gameId, state);
  }

  private isTimerJobCurrent(
    data: ExecuteTurnTimeoutJob,
    state: GameEngineState,
  ): boolean {
    return (
      data.turnNumber === state.turnNumber &&
      data.phase === state.phase &&
      data.currentTurnRoomPlayerId === state.currentTurnRoomPlayerId &&
      data.actionStateKey === this.getActionStateKey(state)
    );
  }

  private getActionStateKey(state: GameEngineState): string {
    if (state.phase !== 'awaiting_auction_bid' || !state.auction) {
      return 'turn';
    }

    return [
      'auction',
      state.auction.currentBid,
      state.auction.highestBidderRoomPlayerId ?? 'none',
      state.auction.passedRoomPlayerIds.join('-') || 'none',
    ].join('_');
  }

  private getIntentRoomPlayerId(intent: GameEngineIntent): string | undefined {
    if (intent.type === 'finish_game_by_time') {
      return undefined;
    }

    return intent.payload.roomPlayerId;
  }

  private async processRefreshLeaderboards(
    job: Job<RefreshLeaderboardSnapshotsJob>,
  ): Promise<void> {
    try {
      await this.leaderboardsService.refreshSnapshots();

      this.observabilityService.recordEvent(
        GAME_EVENTS.leaderboardRefreshSucceeded,
        {
          jobId: job.id,
          reason: job.data.reason,
        },
      );
      this.observabilityService.recordMetric(
        GAME_METRICS.leaderboardRefreshSucceeded,
      );
    } catch (error) {
      this.observabilityService.recordEvent(
        GAME_EVENTS.leaderboardRefreshFailed,
        {
          jobId: job.id,
          reason: job.data.reason,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : undefined,
        },
      );
      this.observabilityService.recordMetric(
        GAME_METRICS.leaderboardRefreshFailed,
      );

      throw error;
    }
  }
}

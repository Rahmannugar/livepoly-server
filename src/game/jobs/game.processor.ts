import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_JOBS, QUEUES } from '../../infra/queue/queue.constants';
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
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameStateService } from '../state/game-state.service';
import { GameTurnTimerPolicyService } from '../timers/game-turn-timer-policy.service';
import { GameTurnTimerQueueService } from '../timers/game-turn-timer-queue.service';
import type { ExecuteTurnTimeoutJob } from '../timers/game-turn-timer.types';
import type { GameJob } from './game-jobs.types';

@Processor(QUEUES.game)
export class GameProcessor extends WorkerHost {
  private readonly logger = new Logger(GameProcessor.name);

  constructor(
    private readonly gameStateService: GameStateService,
    private readonly gameBotService: GameBotService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
    private readonly gameTurnTimerPolicyService: GameTurnTimerPolicyService,
    private readonly observabilityService: ObservabilityService,
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

    this.logger.warn({
      message: 'Unknown game job received',
      jobId: job.id,
      jobName: job.name,
    });
  }

  private async processExecuteBotTurn(job: Job<ExecuteBotTurnJob>) {
    const state = await this.gameStateService.get(job.data.gameId);
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
    const state = await this.gameStateService.get(job.data.gameId);

    if (!this.isTimerJobCurrent(job.data, state)) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerSkipped, {
        jobId: job.id,
        ...job.data,
        currentPhase: state.phase,
        currentTurnNumber: state.turnNumber,
        currentTurnRoomPlayerId: state.currentTurnRoomPlayerId,
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
      data.currentTurnRoomPlayerId === state.currentTurnRoomPlayerId
    );
  }

  private getIntentRoomPlayerId(intent: GameEngineIntent): string | undefined {
    if (intent.type === 'finish_game_by_time') {
      return undefined;
    }

    return intent.payload.roomPlayerId;
  }
}

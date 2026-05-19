import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GAME_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameCommandsService } from '../commands/game-commands.service';
import { GameEngineError } from '../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';
import { GameRealtimePublisher } from '../realtime/game-realtime.publisher';
import { GameStateService } from '../state/game-state.service';
import { GameBotQueueService } from './game-bot-queue.service';
import { GameBotService } from './game-bot.service';
import type { ExecuteBotTurnJob } from './game-bot.types';

@Processor(QUEUES.game)
export class GameBotProcessor extends WorkerHost {
  private readonly logger = new Logger(GameBotProcessor.name);

  constructor(
    private readonly gameStateService: GameStateService,
    private readonly gameBotService: GameBotService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly observabilityService: ObservabilityService,
  ) {
    super();
  }

  async process(job: Job<ExecuteBotTurnJob>) {
    if (job.name !== GAME_JOBS.executeBotTurn) {
      this.logger.warn({
        message: 'Unknown game job received',
        jobId: job.id,
        jobName: job.name,
      });
      return;
    }

    await this.processExecuteBotTurn(job);
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

      await this.gameRealtimePublisher.publishCommandResult(
        job.data.gameId,
        result,
      );

      await this.gameBotQueueService.enqueueIfBotCanAct(
        job.data.gameId,
        result.state,
      );

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
}

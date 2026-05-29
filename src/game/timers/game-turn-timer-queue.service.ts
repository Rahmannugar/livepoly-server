import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import type { GameEngineState } from '../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS, GAME_TURN_TIMER } from '../game.constants';
import type { ExecuteTurnTimeoutJob } from './game-turn-timer.types';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';

@Injectable()
export class GameTurnTimerQueueService {
  constructor(
    @InjectQueue(QUEUES.game) private readonly gameQueue: Queue,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async enqueueTurnTimer(gameId: string, state: GameEngineState) {
    if (state.phase === 'finished' || state.phase === 'cancelled') {
      return;
    }

    const data: ExecuteTurnTimeoutJob = {
      gameId,
      turnNumber: state.turnNumber,
      phase: state.phase,
      currentTurnRoomPlayerId: state.currentTurnRoomPlayerId,
    };

    await this.gameQueue.add(GAME_JOBS.executeTurnTimeout, data, {
      jobId: this.jobId(data),
      delay: GAME_TURN_TIMER.timeoutMs,
      attempts: 3,
      backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });

    this.observabilityService.recordEvent(GAME_EVENTS.turnTimerQueued, {
      ...data,
      delay: GAME_TURN_TIMER.timeoutMs,
    });

    this.observabilityService.recordMetric(GAME_METRICS.turnTimerQueued);
  }

  private jobId(data: ExecuteTurnTimeoutJob): string {
    return [
      'turn-timeout',
      data.gameId,
      data.turnNumber,
      data.phase,
      data.currentTurnRoomPlayerId,
    ].join(':');
  }
}

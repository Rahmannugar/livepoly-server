import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { GAME_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { ObservabilityService } from '../../infra/observability/observability.service';
import type { GameEngineState } from '../engine/game-engine.types';
import { GAME_BOTS, GAME_EVENTS, GAME_METRICS } from '../game.constants';
import { GameBotService } from './game-bot.service';
import type { ExecuteBotTurnJob } from './game-bot.types';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';

@Injectable()
export class GameBotQueueService {
  constructor(
    @InjectQueue(QUEUES.game) private readonly gameQueue: Queue,
    private readonly gameBotService: GameBotService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async enqueueIfBotCanAct(gameId: string, state: GameEngineState) {
    const decision = this.gameBotService.chooseDecision(state);

    if (!decision) {
      return;
    }

    const delay = this.getActionDelay();

    await this.gameQueue.add(
      GAME_JOBS.executeBotTurn,
      { gameId } satisfies ExecuteBotTurnJob,
      {
        jobId: [
          'bot-turn',
          gameId,
          state.turnNumber,
          state.phase,
          decision.roomPlayerId,
          this.getActionStateKey(state),
        ].join('__'),
        delay,
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );

    this.observabilityService.recordEvent(GAME_EVENTS.botTurnQueued, {
      gameId,
      roomPlayerId: decision.roomPlayerId,
      phase: state.phase,
      turnNumber: state.turnNumber,
      delay,
    });

    this.observabilityService.recordMetric(GAME_METRICS.botTurnQueued);
  }

  private getActionDelay(): number {
    const { min, max } = GAME_BOTS.actionDelayMs;

    return Math.round(min + Math.random() * (max - min));
  }

  private getActionStateKey(state: GameEngineState): string {
    if (state.phase !== 'awaiting_auction_bid' || !state.auction) {
      return 'turn';
    }

    return [
      'auction',
      state.auction.currentBid,
      state.auction.highestBidderRoomPlayerId ?? 'none',
      state.auction.currentBidderRoomPlayerId ?? 'none',
      state.auction.passedRoomPlayerIds.join('-') || 'none',
    ].join('_');
  }
}

import type { Queue } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GAME_TURN_TIMER } from '../../game.constants';
import { GameTurnTimerQueueService } from '../game-turn-timer-queue.service';

type QueueMock = {
  add: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameTurnTimerQueueService', () => {
  let service: GameTurnTimerQueueService;
  let gameQueue: QueueMock;
  let observabilityService: ObservabilityServiceMock;

  const state: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_roll',
    turnNumber: 4,
    currentTurnRoomPlayerId: 'room-player-1',
    consecutiveDoublesCount: 0,
    shouldCurrentPlayerPlayAgain: false,
    lastDiceRoll: null,
    pendingTileKey: null,
    auction: null,
    debt: null,
    decks: {
      chance: {
        drawPile: [],
        discardPile: [],
      },
      worldFund: {
        drawPile: [],
        discardPile: [],
      },
    },
    players: [],
    properties: [],
  };

  beforeEach(() => {
    gameQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameTurnTimerQueueService(
      gameQueue as unknown as Queue,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('skips terminal games', async () => {
    await service.enqueueTurnTimer('game-1', {
      ...state,
      phase: 'finished',
    });

    expect(gameQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues a turn timeout with stale guards', async () => {
    await service.enqueueTurnTimer('game-1', state);

    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeTurnTimeout,
      {
        gameId: 'game-1',
        turnNumber: 4,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
      },
      {
        jobId: 'turn-timeout:game-1:4:awaiting_roll:room-player-1',
        delay: GAME_TURN_TIMER.timeoutMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );
  });
});

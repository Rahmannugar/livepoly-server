import type { Queue } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GAME_TURN_TIMER } from '../../game.constants';
import { GameTurnTimerQueueService } from '../game-turn-timer-queue.service';

type QueueMock = {
  add: jest.Mock;
  getJob: jest.Mock;
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
      getJob: jest.fn().mockResolvedValue(null),
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

    expect(gameQueue.getJob).toHaveBeenCalledWith(
      'turn-timeout__game-1__4__awaiting_roll__room-player-1__turn',
    );
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeTurnTimeout,
      {
        gameId: 'game-1',
        turnNumber: 4,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
        actionStateKey: 'turn',
      },
      {
        jobId: 'turn-timeout__game-1__4__awaiting_roll__room-player-1__turn',
        delay: GAME_TURN_TIMER.timeoutMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );
  });

  it('replaces a failed duplicate turn timeout before enqueueing recovery', async () => {
    const failedJob = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gameQueue.getJob.mockResolvedValue(failedJob);

    await service.enqueueTurnTimer('game-1', state);

    expect(failedJob.remove).toHaveBeenCalledTimes(1);
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeTurnTimeout,
      expect.objectContaining({
        gameId: 'game-1',
      }),
      expect.objectContaining({
        jobId: 'turn-timeout__game-1__4__awaiting_roll__room-player-1__turn',
      }),
    );
  });

  it('replaces a failed duplicate game expiry before enqueueing recovery', async () => {
    const failedJob = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gameQueue.getJob.mockResolvedValue(failedJob);

    await service.enqueueGameExpiry('game-1', Date.now() + 60_000);

    expect(gameQueue.getJob).toHaveBeenCalledWith('game-expiry__game-1');
    expect(failedJob.remove).toHaveBeenCalledTimes(1);
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.finishExpiredGame,
      expect.objectContaining({
        gameId: 'game-1',
      }),
      expect.objectContaining({
        jobId: 'game-expiry__game-1',
      }),
    );
  });
});

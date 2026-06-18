import type { Queue } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameEngineState } from '../../engine/game-engine.types';
import type { GameBotService } from '../game-bot.service';
import { GameBotQueueService } from '../game-bot-queue.service';

type QueueMock = {
  add: jest.Mock;
  getJob: jest.Mock;
};

type GameBotServiceMock = {
  chooseDecision: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameBotQueueService', () => {
  let service: GameBotQueueService;
  let mathRandomSpy: jest.SpyInstance;
  let gameQueue: QueueMock;
  let gameBotService: GameBotServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const state: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'casual',
    phase: 'awaiting_roll',
    turnNumber: 3,
    currentTurnRoomPlayerId: 'bot-player-1',
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
    players: [
      {
        roomPlayerId: 'bot-player-1',
        userId: null,
        username: null,
        playerType: 'bot',
        botDifficulty: 'hard',
        botName: 'Ada',
        seatNumber: 1,
        cash: 1500,
        position: 0,
        inJail: false,
        jailTurnCount: 0,
        getOutOfJailFreeCards: 0,
        bankrupt: false,
      },
    ],
    properties: [],
  };

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    gameQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      getJob: jest.fn().mockResolvedValue(null),
    };

    gameBotService = {
      chooseDecision: jest.fn().mockReturnValue({
        roomPlayerId: 'bot-player-1',
        intent: {
          type: 'roll_and_move',
          payload: {
            roomPlayerId: 'bot-player-1',
            dice: [2, 5],
          },
        },
      }),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameBotQueueService(
      gameQueue as unknown as Queue,
      gameBotService as unknown as GameBotService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('skips when no bot can act', async () => {
    gameBotService.chooseDecision.mockReturnValue(null);

    await service.enqueueIfBotCanAct('game-1', state);

    expect(gameQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues bot turn with randomized delay', async () => {
    await service.enqueueIfBotCanAct('game-1', state);

    expect(gameQueue.getJob).toHaveBeenCalledWith(
      'bot-turn__game-1__3__awaiting_roll__bot-player-1__turn',
    );
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      {
        jobId: 'bot-turn__game-1__3__awaiting_roll__bot-player-1__turn',
        delay: 1350,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );
  });

  it('enqueues bot turn end without thinking delay', async () => {
    gameBotService.chooseDecision.mockReturnValue({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'end_turn',
        payload: {
          roomPlayerId: 'bot-player-1',
        },
      },
    });

    await service.enqueueIfBotCanAct('game-1', {
      ...state,
      phase: 'awaiting_turn_end',
    });

    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      {
        jobId: 'bot-turn__game-1__3__awaiting_turn_end__bot-player-1__turn',
        delay: 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );
  });

  it('replaces a failed duplicate job before enqueueing recovery', async () => {
    const failedJob = {
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gameQueue.getJob.mockResolvedValue(failedJob);

    await service.enqueueIfBotCanAct('game-1', state);

    expect(failedJob.remove).toHaveBeenCalledTimes(1);
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      expect.objectContaining({
        jobId: 'bot-turn__game-1__3__awaiting_roll__bot-player-1__turn',
      }),
    );
  });

  it('replaces a completed duplicate job before enqueueing recovery', async () => {
    const completedJob = {
      getState: jest.fn().mockResolvedValue('completed'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gameQueue.getJob.mockResolvedValue(completedJob);

    await service.enqueueIfBotCanAct('game-1', state);

    expect(completedJob.remove).toHaveBeenCalledTimes(1);
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      expect.objectContaining({
        jobId: 'bot-turn__game-1__3__awaiting_roll__bot-player-1__turn',
      }),
    );
  });

  it('keeps an active duplicate job instead of removing in-flight work', async () => {
    const activeJob = {
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    gameQueue.getJob.mockResolvedValue(activeJob);

    await service.enqueueIfBotCanAct('game-1', state);

    expect(activeJob.remove).not.toHaveBeenCalled();
    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      expect.objectContaining({
        jobId: 'bot-turn__game-1__3__awaiting_roll__bot-player-1__turn',
      }),
    );
  });
});

import type { Queue } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GAME_BOTS, GAME_EVENTS, GAME_METRICS } from '../../game.constants';
import type { GameBotService } from '../game-bot.service';
import { GameBotQueueService } from '../game-bot-queue.service';

type QueueMock = {
  add: jest.Mock;
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

  it('does not enqueue when no bot can act', async () => {
    gameBotService.chooseDecision.mockReturnValue(null);

    await service.enqueueIfBotCanAct('game-1', state);

    expect(gameQueue.add).not.toHaveBeenCalled();
    expect(observabilityService.recordEvent).not.toHaveBeenCalled();
  });

  it('enqueues bot turn with human-like randomized delay', async () => {
    await service.enqueueIfBotCanAct('game-1', state);

    expect(gameQueue.add).toHaveBeenCalledWith(
      GAME_JOBS.executeBotTurn,
      { gameId: 'game-1' },
      {
        jobId: 'bot-turn:game-1:3:awaiting_roll:bot-player-1',
        delay: 1350,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
        removeOnFail: 100,
      },
    );
  });

  it('records bot queue telemetry', async () => {
    await service.enqueueIfBotCanAct('game-1', state);

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.botTurnQueued,
      {
        gameId: 'game-1',
        roomPlayerId: 'bot-player-1',
        phase: 'awaiting_roll',
        turnNumber: 3,
        delay: 1350,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.botTurnQueued,
    );
  });
});

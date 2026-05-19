import type { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameCommandsService } from '../../commands/game-commands.service';
import {
  GameEngineError,
  type GameEngineState,
} from '../../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS } from '../../game.constants';
import type { GameRealtimePublisher } from '../../realtime/game-realtime.publisher';
import type { GameStateService } from '../../state/game-state.service';
import type { GameBotQueueService } from '../game-bot-queue.service';
import { GameBotProcessor } from '../game-bot.processor';
import type { GameBotService } from '../game-bot.service';
import type { ExecuteBotTurnJob } from '../game-bot.types';

type GameStateServiceMock = {
  get: jest.Mock;
};

type GameBotServiceMock = {
  chooseDecision: jest.Mock;
};

type GameCommandsServiceMock = {
  executeIntent: jest.Mock;
};

type GameRealtimePublisherMock = {
  publishCommandResult: jest.Mock;
};

type GameBotQueueServiceMock = {
  enqueueIfBotCanAct: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameBotProcessor', () => {
  let processor: GameBotProcessor;
  let loggerWarnSpy: jest.SpyInstance;
  let gameStateService: GameStateServiceMock;
  let gameBotService: GameBotServiceMock;
  let gameCommandsService: GameCommandsServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const state: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'casual',
    phase: 'awaiting_roll',
    turnNumber: 1,
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
    players: [],
    properties: [],
  };

  const decision = {
    roomPlayerId: 'bot-player-1',
    intent: {
      type: 'roll_and_move' as const,
      payload: {
        roomPlayerId: 'bot-player-1',
        dice: [2, 5] as const,
      },
    },
  };

  const commandResult = {
    state: {
      ...state,
      phase: 'awaiting_turn_end' as const,
      lastDiceRoll: [2, 5] as const,
    },
    events: [
      {
        type: 'player_moved' as const,
        roomPlayerId: 'bot-player-1',
        fromPosition: 0,
        toPosition: 7,
        dice: [2, 5] as const,
      },
    ],
    intentType: 'roll_and_move' as const,
  };

  const makeJob = (
    name: string = GAME_JOBS.executeBotTurn,
  ): Job<ExecuteBotTurnJob> =>
    ({
      id: 'job-1',
      name,
      data: {
        gameId: 'game-1',
      },
    }) as Job<ExecuteBotTurnJob>;

  beforeEach(() => {
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    gameStateService = {
      get: jest.fn().mockResolvedValue(state),
    };

    gameBotService = {
      chooseDecision: jest.fn().mockReturnValue(decision),
    };

    gameCommandsService = {
      executeIntent: jest.fn().mockResolvedValue(commandResult),
    };

    gameRealtimePublisher = {
      publishCommandResult: jest.fn().mockResolvedValue(undefined),
    };

    gameBotQueueService = {
      enqueueIfBotCanAct: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    processor = new GameBotProcessor(
      gameStateService as unknown as GameStateService,
      gameBotService as unknown as GameBotService,
      gameCommandsService as unknown as GameCommandsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('ignores unknown game jobs', async () => {
    await processor.process(makeJob('unknown-job'));

    expect(gameStateService.get).not.toHaveBeenCalled();
    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
  });

  it('skips when no bot can act anymore', async () => {
    gameBotService.chooseDecision.mockReturnValue(null);

    await processor.process(makeJob());

    expect(gameStateService.get).toHaveBeenCalledWith('game-1');
    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.botTurnSkipped,
      {
        jobId: 'job-1',
        gameId: 'game-1',
        phase: state.phase,
        turnNumber: state.turnNumber,
      },
    );
  });

  it('executes bot intent through the command service', async () => {
    await processor.process(makeJob());

    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'bot-player-1',
      intent: decision.intent,
    });
  });

  it('publishes realtime result and schedules next bot if needed', async () => {
    await processor.process(makeJob());

    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      commandResult,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      commandResult.state,
    );
  });

  it('records successful bot execution telemetry', async () => {
    await processor.process(makeJob());

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.botTurnExecuted,
      {
        jobId: 'job-1',
        gameId: 'game-1',
        roomPlayerId: 'bot-player-1',
        intentType: 'roll_and_move',
        phase: commandResult.state.phase,
        turnNumber: commandResult.state.turnNumber,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.botTurnExecuted,
    );
  });

  it('records failed bot execution telemetry and rethrows', async () => {
    const error = new GameEngineError(
      'ROLL_NOT_ALLOWED',
      'Player cannot roll at this point in the turn',
    );
    gameCommandsService.executeIntent.mockRejectedValue(error);

    await expect(processor.process(makeJob())).rejects.toBe(error);

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.botTurnFailed,
      {
        jobId: 'job-1',
        gameId: 'game-1',
        roomPlayerId: 'bot-player-1',
        intentType: 'roll_and_move',
        errorCode: 'ROLL_NOT_ALLOWED',
        errorName: 'GameEngineError',
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.botTurnFailed,
    );
  });
});

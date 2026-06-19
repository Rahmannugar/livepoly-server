import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameBotService } from '../../bots/game-bot.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import { createGameEnginePlayer, createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import { GAME_EVENTS, GAME_METRICS, GAME_TIMER_WATCHDOG } from '../../game.constants';
import type { GameRealtimePublisher } from '../../realtime/game-realtime.publisher';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameResultsService } from '../../results/game-results.service';
import type { GameTurnTimerQueueService } from '../game-turn-timer-queue.service';
import type { GameTimerWatchdogRepository } from '../game-timer-watchdog.repository';
import { GameTimerWatchdogService } from '../game-timer-watchdog.service';

type GameTimerWatchdogRepositoryMock = {
  listActiveGames: jest.Mock;
  countJoinedHumanPlayers: jest.Mock;
};

type GameRecoveryServiceMock = {
  getOrRecover: jest.Mock;
};

type GameBotQueueServiceMock = {
  enqueueIfBotCanAct: jest.Mock;
};

type GameBotServiceMock = {
  hasActionableBot: jest.Mock;
  chooseDecision: jest.Mock;
};

type GameTurnTimerQueueServiceMock = {
  enqueueTurnTimer: jest.Mock;
  enqueueGameExpiry: jest.Mock;
};

type GameCommandsServiceMock = {
  executeIntent: jest.Mock;
};

type GameResultsServiceMock = {
  finalizeAbandonedFinishedGame: jest.Mock;
  finalizeExpiredFinishedGame: jest.Mock;
};

type GameRealtimePublisherMock = {
  publishCommandResult: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameTimerWatchdogService', () => {
  let service: GameTimerWatchdogService;
  let nowSpy: jest.SpyInstance<number, []>;
  let repository: GameTimerWatchdogRepositoryMock;
  let gameRecoveryService: GameRecoveryServiceMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let gameBotService: GameBotServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let gameCommandsService: GameCommandsServiceMock;
  let gameResultsService: GameResultsServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let observabilityService: ObservabilityServiceMock;

  const now = 1_000_000;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    repository = {
      listActiveGames: jest.fn().mockResolvedValue([]),
      countJoinedHumanPlayers: jest.fn().mockResolvedValue(1),
    };
    gameRecoveryService = {
      getOrRecover: jest.fn(),
    };
    gameBotQueueService = {
      enqueueIfBotCanAct: jest.fn().mockResolvedValue(undefined),
    };
    gameBotService = {
      hasActionableBot: jest.fn().mockReturnValue(false),
      chooseDecision: jest.fn(),
    };
    gameTurnTimerQueueService = {
      enqueueTurnTimer: jest.fn().mockResolvedValue(undefined),
      enqueueGameExpiry: jest.fn().mockResolvedValue(undefined),
    };
    gameCommandsService = {
      executeIntent: jest.fn(),
    };
    gameResultsService = {
      finalizeAbandonedFinishedGame: jest.fn().mockResolvedValue(undefined),
      finalizeExpiredFinishedGame: jest.fn().mockResolvedValue(undefined),
    };
    gameRealtimePublisher = {
      publishCommandResult: jest.fn().mockResolvedValue(undefined),
    };
    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameTimerWatchdogService(
      repository as unknown as GameTimerWatchdogRepository,
      gameRecoveryService as unknown as GameRecoveryService,
      gameBotQueueService as unknown as GameBotQueueService,
      gameBotService as unknown as GameBotService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      gameCommandsService as unknown as GameCommandsService,
      gameResultsService as unknown as GameResultsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      observabilityService as unknown as ObservabilityService,
    );
  });

  afterEach(() => {
    nowSpy.mockRestore();
    service.onModuleDestroy();
  });

  it('re-enqueues a bot action when an active game is waiting on a bot', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now + 30_000,
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'bot-player-1',
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Nova',
        }),
      ],
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);

    await service.runOnce();

    expect(repository.listActiveGames).toHaveBeenCalledWith(
      GAME_TIMER_WATCHDOG.batchSize,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueGameExpiry).not.toHaveBeenCalled();
  });

  it('finishes an active game when no joined human players remain', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now + 30_000,
      phase: 'awaiting_turn_end',
    });
    const result = {
      state: { ...state, phase: 'finished' as const },
      events: [],
      intentType: 'finish_game_after_last_human_left' as const,
    };

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    repository.countJoinedHumanPlayers.mockResolvedValue(0);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);
    gameCommandsService.executeIntent.mockResolvedValue(result);

    await service.runOnce();

    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      source: 'timer',
      intent: {
        type: 'finish_game_after_last_human_left',
        payload: {
          finishedAt: now,
        },
      },
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      result,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });

  it('finishes an active game when every joined human is bankrupt', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now + 30_000,
      phase: 'awaiting_auction_bid',
      players: createGameEngineState().players.map((player, index) => {
        if (index < 2) {
          return {
            ...player,
            bankrupt: true,
          };
        }

        return {
          ...player,
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot' as const,
          botDifficulty: 'normal' as const,
          botName: 'Midas',
          bankrupt: false,
        };
      }),
    });
    const result = {
      state: { ...state, phase: 'finished' as const },
      events: [],
      intentType: 'finish_game_after_last_human_left' as const,
    };

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    repository.countJoinedHumanPlayers.mockResolvedValue(2);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);
    gameCommandsService.executeIntent.mockResolvedValue(result);

    await service.runOnce();

    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      source: 'timer',
      intent: {
        type: 'finish_game_after_last_human_left',
        payload: {
          finishedAt: now,
        },
      },
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      result,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });

  it('repairs result finalization for a finished game with no joined humans', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: null,
      phase: 'finished',
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    repository.countJoinedHumanPlayers.mockResolvedValue(0);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);

    await service.runOnce();

    expect(
      gameResultsService.finalizeAbandonedFinishedGame,
    ).toHaveBeenCalledWith({
      gameId: 'game-1',
      state,
      finishedAt: now,
    });
    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
  });

  it('re-enqueues a turn timeout when the current turn deadline is overdue', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
      phase: 'awaiting_turn_end',
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);

    await service.runOnce();

    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueGameExpiry).not.toHaveBeenCalled();
  });

  it('executes an overdue bot action directly when queue recovery is not enough', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
      phase: 'awaiting_turn_end',
      currentTurnRoomPlayerId: 'bot-player-1',
      players: [
        createGameEnginePlayer({
          roomPlayerId: 'bot-player-1',
          userId: null,
          username: null,
          playerType: 'bot',
          botDifficulty: 'normal',
          botName: 'Nova',
        }),
      ],
    });
    const result = {
      state: {
        ...state,
        turnNumber: 2,
        currentTurnRoomPlayerId: 'room-player-2',
      },
      events: [
        {
          type: 'turn_ended' as const,
          roomPlayerId: 'bot-player-1',
          nextRoomPlayerId: 'room-player-2',
          turnNumber: 2,
        },
      ],
      intentType: 'end_turn' as const,
    };

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);
    gameBotService.hasActionableBot.mockReturnValue(true);
    gameBotService.chooseDecision.mockReturnValue({
      roomPlayerId: 'bot-player-1',
      intent: {
        type: 'end_turn',
        payload: { roomPlayerId: 'bot-player-1' },
      },
    });
    gameCommandsService.executeIntent.mockResolvedValue(result);

    await service.runOnce();

    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'bot-player-1',
      source: 'bot',
      intent: {
        type: 'end_turn',
        payload: { roomPlayerId: 'bot-player-1' },
      },
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      result,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      result.state,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      result.state,
    );
  });

  it('re-enqueues game expiry when an active game has passed its match deadline', async () => {
    const state = createGameEngineState({
      expiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
      turnExpiresAt: now - 30_000,
      phase: 'awaiting_roll',
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);

    await service.runOnce();

    expect(gameTurnTimerQueueService.enqueueGameExpiry).toHaveBeenCalledWith(
      'game-1',
      state.expiresAt,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });

  it('records one game recovery failure but keeps scanning the remaining games', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', roomId: 'room-1', expiresAt: new Date(now + 60_000) },
      { id: 'game-2', roomId: 'room-2', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover
      .mockRejectedValueOnce(new Error('missing state'))
      .mockResolvedValueOnce(state);

    await service.runOnce();

    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-2',
      state,
    );
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.timerWatchdogFailed,
      expect.objectContaining({
        gameId: 'game-1',
        errorMessage: 'missing state',
      }),
    );
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.timerWatchdogCompleted,
      expect.objectContaining({
        scannedCount: 2,
        recoveryFailures: 1,
      }),
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.timerWatchdogCompleted,
    );
  });
});

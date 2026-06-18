import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import { createGameEnginePlayer, createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import { GAME_EVENTS, GAME_METRICS, GAME_TIMER_WATCHDOG } from '../../game.constants';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameTurnTimerQueueService } from '../game-turn-timer-queue.service';
import type { GameTimerWatchdogRepository } from '../game-timer-watchdog.repository';
import { GameTimerWatchdogService } from '../game-timer-watchdog.service';

type GameTimerWatchdogRepositoryMock = {
  listActiveGames: jest.Mock;
};

type GameRecoveryServiceMock = {
  getOrRecover: jest.Mock;
};

type GameBotQueueServiceMock = {
  enqueueIfBotCanAct: jest.Mock;
};

type GameTurnTimerQueueServiceMock = {
  enqueueTurnTimer: jest.Mock;
  enqueueGameExpiry: jest.Mock;
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
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const now = 1_000_000;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    repository = {
      listActiveGames: jest.fn().mockResolvedValue([]),
    };
    gameRecoveryService = {
      getOrRecover: jest.fn(),
    };
    gameBotQueueService = {
      enqueueIfBotCanAct: jest.fn().mockResolvedValue(undefined),
    };
    gameTurnTimerQueueService = {
      enqueueTurnTimer: jest.fn().mockResolvedValue(undefined),
      enqueueGameExpiry: jest.fn().mockResolvedValue(undefined),
    };
    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameTimerWatchdogService(
      repository as unknown as GameTimerWatchdogRepository,
      gameRecoveryService as unknown as GameRecoveryService,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
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
      { id: 'game-1', expiresAt: new Date(now + 60_000) },
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

  it('re-enqueues a turn timeout when the current turn deadline is overdue', async () => {
    const state = createGameEngineState({
      expiresAt: now + 60_000,
      turnExpiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
      phase: 'awaiting_turn_end',
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', expiresAt: new Date(now + 60_000) },
    ]);
    gameRecoveryService.getOrRecover.mockResolvedValue(state);

    await service.runOnce();

    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueGameExpiry).not.toHaveBeenCalled();
  });

  it('re-enqueues game expiry when an active game has passed its match deadline', async () => {
    const state = createGameEngineState({
      expiresAt: now - GAME_TIMER_WATCHDOG.deadlineGraceMs,
      turnExpiresAt: now - 30_000,
      phase: 'awaiting_roll',
    });

    repository.listActiveGames.mockResolvedValue([
      { id: 'game-1', expiresAt: new Date(now + 60_000) },
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
      { id: 'game-1', expiresAt: new Date(now + 60_000) },
      { id: 'game-2', expiresAt: new Date(now + 60_000) },
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

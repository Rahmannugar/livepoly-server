import type { Job } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameBotService } from '../../bots/game-bot.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import type { GameEngineIntent } from '../../engine/game-engine-intents';
import { GameEngineError } from '../../engine/game-engine.types';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { GameRealtimePublisher } from '../../realtime/game-realtime.publisher';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameResultsService } from '../../results/game-results.service';
import type { GameTurnTimerPolicyService } from '../../timers/game-turn-timer-policy.service';
import type { GameTurnTimerQueueService } from '../../timers/game-turn-timer-queue.service';
import { GAME_METRICS } from '../../game.constants';
import type { GameJob } from '../game-jobs.types';
import { GameProcessor } from '../game.processor';
import type { LeaderboardsService } from '../../../leaderboards/leaderboards.service';

type GameRecoveryServiceMock = {
  getOrRecover: jest.Mock;
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

type GameTurnTimerQueueServiceMock = {
  enqueueTurnTimer: jest.Mock;
};

type GameTurnTimerPolicyServiceMock = {
  chooseTimeoutIntent: jest.Mock;
};

type GameResultsServiceMock = {
  finalizeExpiredFinishedGame: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

type LeaderboardsServiceMock = {
  refreshSnapshots: jest.Mock;
};

describe('GameProcessor', () => {
  let processor: GameProcessor;
  let gameRecoveryService: GameRecoveryServiceMock;
  let gameBotService: GameBotServiceMock;
  let gameCommandsService: GameCommandsServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let gameTurnTimerPolicyService: GameTurnTimerPolicyServiceMock;
  let gameResultsService: GameResultsServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let leaderboardsService: LeaderboardsServiceMock;

  const state = createGameEngineState({
    phase: 'awaiting_roll',
    turnNumber: 7,
    currentTurnRoomPlayerId: 'room-player-1',
  });
  const currentTurnActionStateKey = `turn_${state.turnExpiresAt}`;

  const rollIntent: GameEngineIntent = {
    type: 'roll_and_move',
    payload: {
      roomPlayerId: 'room-player-1',
      dice: [2, 5],
    },
  };

  const commandResult = {
    state,
    events: [
      {
        type: 'player_moved' as const,
        roomPlayerId: 'room-player-1',
        fromPosition: 0,
        toPosition: 7,
        dice: [2, 5] as const,
      },
    ],
    intentType: 'roll_and_move' as const,
  };

  beforeEach(() => {
    gameRecoveryService = {
      getOrRecover: jest.fn().mockResolvedValue(state),
    };

    gameBotService = {
      chooseDecision: jest.fn().mockReturnValue({
        roomPlayerId: 'room-player-1',
        intent: rollIntent,
      }),
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

    gameTurnTimerQueueService = {
      enqueueTurnTimer: jest.fn().mockResolvedValue(undefined),
    };

    gameTurnTimerPolicyService = {
      chooseTimeoutIntent: jest.fn().mockReturnValue(rollIntent),
    };

    gameResultsService = {
      finalizeExpiredFinishedGame: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    leaderboardsService = {
      refreshSnapshots: jest.fn(),
    };

    processor = new GameProcessor(
      gameRecoveryService as unknown as GameRecoveryService,
      gameBotService as unknown as GameBotService,
      gameCommandsService as unknown as GameCommandsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      gameTurnTimerPolicyService as unknown as GameTurnTimerPolicyService,
      gameResultsService as unknown as GameResultsService,
      observabilityService as unknown as ObservabilityService,
      leaderboardsService as unknown as LeaderboardsService,
    );
  });

  it('executes a bot turn', async () => {
    await processor.process(
      makeJob(GAME_JOBS.executeBotTurn, {
        gameId: 'game-1',
      }),
    );

    expect(gameRecoveryService.getOrRecover).toHaveBeenCalledWith('game-1');
    expect(gameBotService.chooseDecision).toHaveBeenCalledWith(state);
    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      source: 'bot',
      intent: rollIntent,
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      commandResult,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
  });

  it('skips bot turns with no legal decision', async () => {
    gameBotService.chooseDecision.mockReturnValue(null);

    await processor.process(
      makeJob(GAME_JOBS.executeBotTurn, {
        gameId: 'game-1',
      }),
    );

    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
  });

  it('does not retry an applied bot command when follow-up work fails', async () => {
    gameRealtimePublisher.publishCommandResult.mockRejectedValue(
      new Error('realtime down'),
    );
    gameBotQueueService.enqueueIfBotCanAct.mockRejectedValue(
      new Error('bot queue down'),
    );
    gameTurnTimerQueueService.enqueueTurnTimer.mockRejectedValue(
      new Error('timer queue down'),
    );

    await expect(
      processor.process(
        makeJob(GAME_JOBS.executeBotTurn, {
          gameId: 'game-1',
        }),
      ),
    ).resolves.toBeUndefined();

    expect(gameCommandsService.executeIntent).toHaveBeenCalledTimes(1);
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.realtimePublishFailed,
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.botTurnFailed,
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.turnTimerFailed,
    );
  });

  it('executes a current turn timeout', async () => {
    await processor.process(
      makeJob(GAME_JOBS.executeTurnTimeout, {
        gameId: 'game-1',
        turnNumber: 7,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
        actionStateKey: currentTurnActionStateKey,
      }),
    );

    expect(gameRecoveryService.getOrRecover).toHaveBeenCalledWith('game-1');
    expect(gameTurnTimerPolicyService.chooseTimeoutIntent).toHaveBeenCalledWith(
      state,
    );
    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      source: 'timer',
      intent: rollIntent,
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      commandResult,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
  });

  it('skips stale turn timeouts', async () => {
    await processor.process(
      makeJob(GAME_JOBS.executeTurnTimeout, {
        gameId: 'game-1',
        turnNumber: 6,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
        actionStateKey: 'turn',
      }),
    );

    expect(
      gameTurnTimerPolicyService.chooseTimeoutIntent,
    ).not.toHaveBeenCalled();
    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
  });

  it('skips turn timeouts with no policy intent', async () => {
    gameTurnTimerPolicyService.chooseTimeoutIntent.mockReturnValue(null);

    await processor.process(
      makeJob(GAME_JOBS.executeTurnTimeout, {
        gameId: 'game-1',
        turnNumber: 7,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
        actionStateKey: currentTurnActionStateKey,
      }),
    );

    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
  });

  it('finishes expired games through the expiry job', async () => {
    await processor.process(
      makeJob(GAME_JOBS.finishExpiredGame, {
        gameId: 'game-1',
        expiresAt: 1_800_000,
      }),
    );

    expect(gameRecoveryService.getOrRecover).toHaveBeenCalledWith('game-1');
    const executeCalls = gameCommandsService.executeIntent.mock
      .calls as unknown[][];
    const executeInput = executeCalls[0]?.[0] as {
      gameId: string;
      source: string;
      intent: GameEngineIntent;
    };

    expect(executeInput.gameId).toBe('game-1');
    expect(executeInput.source).toBe('timer');
    expect(executeInput.intent.type).toBe('finish_game_by_time');
    if (executeInput.intent.type !== 'finish_game_by_time') {
      throw new Error('Expected finish by time intent');
    }
    expect(typeof executeInput.intent.payload.finishedAt).toBe('number');
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      commandResult,
    );
  });

  it('repairs finalization for already finished games in the expiry job', async () => {
    const finishedState = createGameEngineState({
      phase: 'finished',
      expiresAt: 1_800_000,
    });

    gameRecoveryService.getOrRecover.mockResolvedValueOnce(finishedState);

    await processor.process(
      makeJob(GAME_JOBS.finishExpiredGame, {
        gameId: 'game-1',
        expiresAt: 1_800_000,
      }),
    );

    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
    const finalizeCalls = gameResultsService.finalizeExpiredFinishedGame.mock
      .calls as unknown[][];
    const finalizeInput = finalizeCalls[0]?.[0] as {
      gameId: string;
      state: typeof finishedState;
      finishedAt: number;
    };

    expect(finalizeInput).toMatchObject({
      gameId: 'game-1',
      state: finishedState,
    });
    expect(typeof finalizeInput.finishedAt).toBe('number');
  });

  it('repairs finalization when an expiry command finds the game already closed', async () => {
    const expiredAt = Date.now() - 1_000;
    const activeState = createGameEngineState({
      phase: 'awaiting_roll',
      expiresAt: expiredAt,
    });
    const finishedState = createGameEngineState({
      phase: 'finished',
      expiresAt: expiredAt,
    });

    gameRecoveryService.getOrRecover
      .mockResolvedValueOnce(activeState)
      .mockResolvedValueOnce(finishedState);
    gameCommandsService.executeIntent.mockRejectedValueOnce(
      new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active'),
    );

    await processor.process(
      makeJob(GAME_JOBS.finishExpiredGame, {
        gameId: 'game-1',
        expiresAt: expiredAt,
      }),
    );

    const finalizeCalls = gameResultsService.finalizeExpiredFinishedGame.mock
      .calls as unknown[][];
    const finalizeInput = finalizeCalls[0]?.[0] as {
      gameId: string;
      state: typeof finishedState;
      finishedAt: number;
    };

    expect(finalizeInput).toMatchObject({
      gameId: 'game-1',
      state: finishedState,
    });
    expect(typeof finalizeInput.finishedAt).toBe('number');
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
  });

  it('skips expiry jobs for cancelled games', async () => {
    gameRecoveryService.getOrRecover.mockResolvedValueOnce(
      createGameEngineState({ phase: 'cancelled' }),
    );

    await processor.process(
      makeJob(GAME_JOBS.finishExpiredGame, {
        gameId: 'game-1',
        expiresAt: 1_800_000,
      }),
    );

    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
    expect(
      gameResultsService.finalizeExpiredFinishedGame,
    ).not.toHaveBeenCalled();
  });

  it('does not finish games before their expiry time', async () => {
    const futureExpiresAt = Date.now() + 60_000;

    gameRecoveryService.getOrRecover.mockResolvedValueOnce(
      createGameEngineState({
        expiresAt: futureExpiresAt,
      }),
    );

    await expect(
      processor.process(
        makeJob(GAME_JOBS.finishExpiredGame, {
          gameId: 'game-1',
          expiresAt: futureExpiresAt,
        }),
      ),
    ).rejects.toThrow('Game expiry job ran before the game expired');

    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
  });

  it('rethrows recovery failures for retry', async () => {
    const error = new Error('recovery failed');
    gameRecoveryService.getOrRecover.mockRejectedValue(error);

    await expect(
      processor.process(
        makeJob(GAME_JOBS.executeBotTurn, {
          gameId: 'game-1',
        }),
      ),
    ).rejects.toThrow(error);

    expect(gameBotService.chooseDecision).not.toHaveBeenCalled();
    expect(gameCommandsService.executeIntent).not.toHaveBeenCalled();
  });

  it('rethrows command failures for retry', async () => {
    const error = new Error('command failed');
    gameCommandsService.executeIntent.mockRejectedValue(error);

    await expect(
      processor.process(
        makeJob(GAME_JOBS.executeBotTurn, {
          gameId: 'game-1',
        }),
      ),
    ).rejects.toThrow(error);

    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });
});

function makeJob(name: string, data: GameJob): Job<GameJob> {
  return {
    id: `${name}-job-1`,
    name,
    data,
  } as Job<GameJob>;
}

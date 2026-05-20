import type { Job } from 'bullmq';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import { GAME_JOBS } from '../../../infra/queue/queue.constants';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameBotService } from '../../bots/game-bot.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import type { GameEngineIntent } from '../../engine/game-engine-intents';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { GameRealtimePublisher } from '../../realtime/game-realtime.publisher';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameTurnTimerPolicyService } from '../../timers/game-turn-timer-policy.service';
import type { GameTurnTimerQueueService } from '../../timers/game-turn-timer-queue.service';
import type { GameJob } from '../game-jobs.types';
import { GameProcessor } from '../game.processor';

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

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
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
  let observabilityService: ObservabilityServiceMock;

  const state = createGameEngineState({
    phase: 'awaiting_roll',
    turnNumber: 7,
    currentTurnRoomPlayerId: 'room-player-1',
  });

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

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    processor = new GameProcessor(
      gameRecoveryService as unknown as GameRecoveryService,
      gameBotService as unknown as GameBotService,
      gameCommandsService as unknown as GameCommandsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      gameTurnTimerPolicyService as unknown as GameTurnTimerPolicyService,
      observabilityService as unknown as ObservabilityService,
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
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });

  it('executes a current turn timeout', async () => {
    await processor.process(
      makeJob(GAME_JOBS.executeTurnTimeout, {
        gameId: 'game-1',
        turnNumber: 7,
        phase: 'awaiting_roll',
        currentTurnRoomPlayerId: 'room-player-1',
      }),
    );

    expect(gameRecoveryService.getOrRecover).toHaveBeenCalledWith('game-1');
    expect(gameTurnTimerPolicyService.chooseTimeoutIntent).toHaveBeenCalledWith(
      state,
    );
    expect(gameCommandsService.executeIntent).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
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
      }),
    );

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

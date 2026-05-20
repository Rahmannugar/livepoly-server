import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import {
  GameEngineError,
  type GameEngineState,
} from '../../engine/game-engine.types';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameSnapshotService } from '../../snapshots/game-snapshots.service';
import type { GameStateService } from '../../state/game-state.service';
import { GameCommandsService } from '../game-commands.service';

type GameStateServiceMock = {
  update: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

type GameSnapshotServiceMock = {
  createSnapshotAfterCommand: jest.Mock;
};

type GameRecoveryServiceMock = {
  recoverOrThrow: jest.Mock;
};

describe('GameCommandsService', () => {
  let service: GameCommandsService;
  let gameStateService: GameStateServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let gameSnapshotService: GameSnapshotServiceMock;
  let gameRecoveryService: GameRecoveryServiceMock;

  const state: GameEngineState = createGameEngineState({
    phase: 'awaiting_roll',
  });

  beforeEach(() => {
    gameStateService = {
      update: jest.fn(),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    gameSnapshotService = {
      createSnapshotAfterCommand: jest.fn().mockResolvedValue(undefined),
    };

    gameRecoveryService = {
      recoverOrThrow: jest.fn().mockResolvedValue(state),
    };

    service = new GameCommandsService(
      gameStateService as unknown as GameStateService,
      observabilityService as unknown as ObservabilityService,
      gameSnapshotService as unknown as GameSnapshotService,
      gameRecoveryService as unknown as GameRecoveryService,
    );
  });

  it('executes roll and move inside a state update', async () => {
    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(state),
    );

    const result = await service.rollAndMove({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      dice: [1, 2],
    });

    expect(gameStateService.update).toHaveBeenCalledWith(
      'game-1',
      expect.any(Function),
    );
    expect(result).toMatchObject({
      intentType: 'roll_and_move',
      state: {
        phase: 'awaiting_property_decision',
        pendingTileKey: 'ghana',
      },
    });
    expect(result.events).toContainEqual({
      type: 'player_moved',
      roomPlayerId: 'room-player-1',
      fromPosition: 0,
      toPosition: 3,
      dice: [1, 2],
    });
    expect(gameSnapshotService.createSnapshotAfterCommand).toHaveBeenCalledWith(
      'game-1',
      result.state,
    );
  });

  it('executes end turn inside a state update', async () => {
    const turnEndState = createGameEngineState({
      phase: 'awaiting_turn_end',
    });

    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(turnEndState),
    );

    const result = await service.endTurn({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
    });

    expect(result).toMatchObject({
      intentType: 'end_turn',
      state: {
        phase: 'awaiting_roll',
        turnNumber: 2,
        currentTurnRoomPlayerId: 'room-player-2',
      },
    });
    expect(result.events).toEqual([
      {
        type: 'turn_ended',
        roomPlayerId: 'room-player-1',
        nextRoomPlayerId: 'room-player-2',
        turnNumber: 2,
      },
    ]);
    expect(gameSnapshotService.createSnapshotAfterCommand).toHaveBeenCalledWith(
      'game-1',
      result.state,
    );
  });

  it('executes a generic engine intent', async () => {
    const finishableState = createGameEngineState({
      phase: 'awaiting_roll',
    });

    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(finishableState),
    );

    const result = await service.executeIntent({
      gameId: 'game-1',
      intent: {
        type: 'finish_game_by_time',
        payload: {
          finishedAt: 1779150000000,
        },
      },
    });

    expect(result).toMatchObject({
      intentType: 'finish_game_by_time',
      state: {
        phase: 'finished',
      },
    });
    expect(result.events[0]).toMatchObject({
      type: 'game_finished_by_time',
      finishedAt: 1779150000000,
    });
    expect(gameSnapshotService.createSnapshotAfterCommand).toHaveBeenCalledWith(
      'game-1',
      result.state,
    );
  });

  it('recovers missing Redis state once and retries command', async () => {
    gameStateService.update
      .mockRejectedValueOnce(new NotFoundException('Game state not found'))
      .mockImplementationOnce(async (_gameId, updater) => updater(state));

    const result = await service.rollAndMove({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      dice: [1, 2],
    });

    expect(gameRecoveryService.recoverOrThrow).toHaveBeenCalledWith('game-1');
    expect(gameStateService.update).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      intentType: 'roll_and_move',
      state: {
        phase: 'awaiting_property_decision',
      },
    });
  });

  it('does not retry command after recovery already happened', async () => {
    gameStateService.update.mockRejectedValue(
      new NotFoundException('Game state not found'),
    );

    await expect(
      service.rollAndMove({
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        dice: [1, 2],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(gameRecoveryService.recoverOrThrow).toHaveBeenCalledTimes(1);
    expect(gameStateService.update).toHaveBeenCalledTimes(2);
  });

  it('returns command result when snapshot creation fails', async () => {
    gameSnapshotService.createSnapshotAfterCommand.mockRejectedValue(
      new Error('snapshot failed'),
    );
    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(state),
    );

    const result = await service.rollAndMove({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      dice: [1, 2],
    });

    expect(result).toMatchObject({
      intentType: 'roll_and_move',
      state: {
        phase: 'awaiting_property_decision',
      },
    });
  });

  it('rejects intents for another player', async () => {
    await expect(
      service.executeIntent({
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        intent: {
          type: 'roll_and_move',
          payload: {
            roomPlayerId: 'room-player-2',
            dice: [1, 2],
          },
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(gameStateService.update).not.toHaveBeenCalled();
    expect(gameRecoveryService.recoverOrThrow).not.toHaveBeenCalled();
    expect(
      gameSnapshotService.createSnapshotAfterCommand,
    ).not.toHaveBeenCalled();
  });

  it('rethrows failed game commands', async () => {
    const error = new GameEngineError(
      'NOT_CURRENT_TURN',
      'It is not this player’s turn',
    );

    gameStateService.update.mockRejectedValue(error);

    await expect(
      service.rollAndMove({
        gameId: 'game-1',
        roomPlayerId: 'room-player-2',
        dice: [1, 2],
      }),
    ).rejects.toThrow(error);

    expect(gameRecoveryService.recoverOrThrow).not.toHaveBeenCalled();
    expect(
      gameSnapshotService.createSnapshotAfterCommand,
    ).not.toHaveBeenCalled();
  });
});

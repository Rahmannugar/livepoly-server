import { BadRequestException } from '@nestjs/common';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_EVENTS, GAME_METRICS } from '../game.constants';
import {
  GameEngineError,
  type GameEngineState,
} from '../engine/game-engine.types';
import { createGameEngineState } from '../engine/tests/game-engine.test-factory';
import type { GameStateService } from '../state/game-state.service';
import { GameCommandsService } from './game-commands.service';

type GameStateServiceMock = {
  update: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameCommandsService', () => {
  let service: GameCommandsService;
  let gameStateService: GameStateServiceMock;
  let observabilityService: ObservabilityServiceMock;

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

    service = new GameCommandsService(
      gameStateService as unknown as GameStateService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('executes roll and move through an engine intent inside serialized state update', async () => {
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
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.commandSucceeded,
      {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        command: 'roll_and_move',
        mode: 'ranked',
        phase: 'awaiting_property_decision',
        turnNumber: 1,
        eventCount: result.events.length,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.commandSucceeded('roll_and_move'),
    );
  });

  it('executes end turn through an engine intent inside serialized state update', async () => {
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
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.commandSucceeded,
      {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        command: 'end_turn',
        mode: 'ranked',
        phase: 'awaiting_roll',
        turnNumber: 2,
        eventCount: 1,
      },
    );
  });

  it('executes generic engine intents', async () => {
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
  });

  it('rejects player-scoped intents that do not match server resolved actor', async () => {
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
  });

  it('records failed game commands', async () => {
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

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.commandFailed,
      {
        gameId: 'game-1',
        roomPlayerId: 'room-player-2',
        command: 'roll_and_move',
        errorCode: 'NOT_CURRENT_TURN',
        errorName: 'GameEngineError',
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.commandFailed('roll_and_move'),
    );
  });
});

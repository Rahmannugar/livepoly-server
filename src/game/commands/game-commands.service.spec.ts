import type { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_COMMANDS, GAME_EVENTS, GAME_METRICS } from '../game.constants';
import type { GameEngineService } from '../engine/game-engine.service';
import {
  GameEngineError,
  type GameEngineState,
} from '../engine/game-engine.types';
import type { GameStateService } from '../state/game-state.service';
import { GameCommandsService } from './game-commands.service';

type GameStateServiceMock = {
  update: jest.Mock;
};

type GameEngineServiceMock = {
  rollAndMove: jest.Mock;
  endTurn: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameCommandsService', () => {
  let service: GameCommandsService;
  let gameStateService: GameStateServiceMock;
  let gameEngineService: GameEngineServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const state: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_roll',
    turnNumber: 2,
    currentTurnRoomPlayerId: 'room-player-1',
    lastDiceRoll: null,
    players: [],
  };

  beforeEach(() => {
    gameStateService = {
      update: jest.fn(),
    };

    gameEngineService = {
      rollAndMove: jest.fn(),
      endTurn: jest.fn(),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameCommandsService(
      gameStateService as unknown as GameStateService,
      gameEngineService as unknown as GameEngineService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('applies roll and move through a serialized state update', async () => {
    const nextState: GameEngineState = {
      ...state,
      phase: 'awaiting_turn_end',
      lastDiceRoll: [3, 4],
    };

    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(state),
    );
    gameEngineService.rollAndMove.mockReturnValue(nextState);

    const result = await service.rollAndMove({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });

    expect(gameStateService.update).toHaveBeenCalledWith(
      'game-1',
      expect.any(Function),
    );
    expect(gameEngineService.rollAndMove).toHaveBeenCalledWith(state, {
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.commandSucceeded,
      {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        command: GAME_COMMANDS.rollAndMove,
        mode: 'ranked',
        phase: 'awaiting_turn_end',
        turnNumber: 2,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.commandSucceeded(GAME_COMMANDS.rollAndMove),
    );
    expect(result).toEqual({ state: nextState });
  });

  it('applies end turn through a serialized state update', async () => {
    const nextState: GameEngineState = {
      ...state,
      phase: 'awaiting_roll',
      turnNumber: 3,
      currentTurnRoomPlayerId: 'room-player-2',
    };

    gameStateService.update.mockImplementation(async (_gameId, updater) =>
      updater(state),
    );
    gameEngineService.endTurn.mockReturnValue(nextState);

    const result = await service.endTurn({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
    });

    expect(gameStateService.update).toHaveBeenCalledWith(
      'game-1',
      expect.any(Function),
    );
    expect(gameEngineService.endTurn).toHaveBeenCalledWith(state, {
      roomPlayerId: 'room-player-1',
    });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.commandSucceeded,
      {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
        command: GAME_COMMANDS.endTurn,
        mode: 'ranked',
        phase: 'awaiting_roll',
        turnNumber: 3,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.commandSucceeded(GAME_COMMANDS.endTurn),
    );
    expect(result).toEqual({ state: nextState });
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
        command: GAME_COMMANDS.rollAndMove,
        errorCode: 'NOT_CURRENT_TURN',
        errorName: 'GameEngineError',
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.commandFailed(GAME_COMMANDS.rollAndMove),
    );
  });
});

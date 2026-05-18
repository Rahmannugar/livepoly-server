import { GameCommandsService } from './game-commands.service';
import type { GameEngineService } from '../engine/game-engine.service';
import type { GameEngineState } from '../engine/game-engine.types';
import type { GameStateService } from '../state/game-state.service';

type GameStateServiceMock = {
  update: jest.Mock;
};

type GameEngineServiceMock = {
  rollAndMove: jest.Mock;
  endTurn: jest.Mock;
};

describe('GameCommandsService', () => {
  let service: GameCommandsService;
  let gameStateService: GameStateServiceMock;
  let gameEngineService: GameEngineServiceMock;

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

    service = new GameCommandsService(
      gameStateService as unknown as GameStateService,
      gameEngineService as unknown as GameEngineService,
    );
  });

  it('applies roll and move through a serialized state update', async () => {
    const nextState = {
      ...state,
      phase: 'awaiting_turn_end' as const,
      lastDiceRoll: [3, 4] as const,
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
    expect(result).toEqual({ state: nextState });
  });

  it('applies end turn through a serialized state update', async () => {
    const nextState = {
      ...state,
      phase: 'awaiting_roll' as const,
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
    expect(result).toEqual({ state: nextState });
  });
});

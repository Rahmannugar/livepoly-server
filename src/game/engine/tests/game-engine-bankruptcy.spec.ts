import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-bankruptcy', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('declares player bankrupt and returns assets to bank when there is no creditor', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 2,
            mortgaged: true,
          };
        }

        return property;
      }),
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0]).toMatchObject({
      cash: 0,
      bankrupt: true,
      inJail: false,
      jailTurnCount: 0,
      getOutOfJailFreeCards: 0,
    });
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      ownerRoomPlayerId: null,
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    });
    expect(result.events).toContainEqual({
      type: 'player_bankrupt',
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: null,
    });
  });

  it('transfers owned assets to creditor and clears buildings and mortgages', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 0,
            hasHotel: true,
            mortgaged: true,
          };
        }

        return property;
      }),
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: 'room-player-2',
    });

    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-2',
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    });
    expect(result.events).toContainEqual({
      type: 'player_bankrupt',
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: 'room-player-2',
    });
  });

  it('moves turn to next active player when current player goes bankrupt', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      currentTurnRoomPlayerId: 'room-player-1',
      turnNumber: 4,
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-2',
      turnNumber: 5,
      lastDiceRoll: null,
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
    });
    expect(result.events).toContainEqual({
      type: 'turn_ended',
      roomPlayerId: 'room-player-1',
      nextRoomPlayerId: 'room-player-2',
      turnNumber: 5,
    });
  });

  it('does not move turn when a non-current player goes bankrupt', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-1',
      turnNumber: 2,
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-2',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-1',
      turnNumber: 2,
    });
    expect(result.events).toEqual([
      {
        type: 'player_bankrupt',
        roomPlayerId: 'room-player-2',
        creditorRoomPlayerId: null,
      },
    ]);
  });

  it('finishes the game when only one active player remains', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      currentTurnRoomPlayerId: 'room-player-2',
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-3') {
          return {
            ...player,
            bankrupt: true,
          };
        }

        return player;
      }),
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-2',
      creditorRoomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'finished',
      currentTurnRoomPlayerId: 'room-player-1',
    });
    expect(result.events).toEqual([
      {
        type: 'player_bankrupt',
        roomPlayerId: 'room-player-2',
        creditorRoomPlayerId: 'room-player-1',
      },
      {
        type: 'game_finished_by_bankruptcy',
        winnerRoomPlayerId: 'room-player-1',
      },
    ]);
  });

  it('rejects bankruptcy with inactive creditor', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-2') {
          return {
            ...player,
            bankrupt: true,
          };
        }

        return player;
      }),
    });

    expect(() =>
      service.declareBankruptcy(state, {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects declaring an already bankrupt player bankrupt again', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            bankrupt: true,
          };
        }

        return player;
      }),
    });

    expect(() =>
      service.declareBankruptcy(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(GameEngineError);
  });
});

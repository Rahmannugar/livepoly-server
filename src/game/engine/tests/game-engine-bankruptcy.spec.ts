import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import {
  createGameEngineState,
  TEST_BOARD_TILES,
} from './game-engine.test-factory';

describe('game-engine-bankruptcy', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('returns assets to bank without creditor', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
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
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
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

  it('transfers assets to creditor', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
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
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
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

  it('moves turn after current player bankruptcy', () => {
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

  it('keeps turn after non-current player bankruptcy', () => {
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

  it('finishes game with one active player', () => {
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
        tiedRoomPlayerIds: ['room-player-1'],
        standings: [
          {
            roomPlayerId: 'room-player-1',
            seatNumber: 1,
            cash: 1500,
            ownedPropertyCount: 0,
            assetValue: 0,
            netWorth: 1500,
          },
        ],
      },
    ]);
  });

  it('uses active debt creditor by default', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 200,
        reason: 'rent',
      },
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = service.declareBankruptcy(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.debt).toBeNull();
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-2',
    });
    expect(result.events).toContainEqual({
      type: 'player_bankrupt',
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: 'room-player-2',
    });
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

  it('rejects already bankrupt player', () => {
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

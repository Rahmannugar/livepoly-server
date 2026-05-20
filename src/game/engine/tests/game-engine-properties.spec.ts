import {
  buyProperty,
  createInitialPropertyState,
} from '../game-engine-properties';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState, TEST_BOARD_TILES } from './game-engine.test-factory';

describe('game-engine-properties', () => {
  it('creates initial ownership state', () => {
    const properties = createInitialPropertyState({
      boardKey: 'classic',
    });

    expect(properties).toHaveLength(28);
    expect(properties).toContainEqual({
      tileKey: TEST_BOARD_TILES.cheapProperty,
      ownerRoomPlayerId: null,
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    });
    expect(properties).toContainEqual({
      tileKey: TEST_BOARD_TILES.airport,
      ownerRoomPlayerId: null,
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    });
    expect(properties).toContainEqual({
      tileKey: TEST_BOARD_TILES.utility,
      ownerRoomPlayerId: null,
      houseCount: 0,
      hasHotel: false,
      mortgaged: false,
    });
  });

  it('buys pending property', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    const result = buyProperty(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(result.state.players[0]).toMatchObject({
      roomPlayerId: 'room-player-1',
      cash: 1440,
    });
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
    expect(result.events).toEqual([
      {
        type: 'property_bought',
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
        amount: 60,
      },
    ]);
  });

  it('buys pending airport tiles', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.airport,
    });

    const result = buyProperty(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0].cash).toBe(1300);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.airport,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
  });

  it('buys pending utility tiles', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.utility,
    });

    const result = buyProperty(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0].cash).toBe(1350);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.utility,
      ),
    ).toMatchObject({
      ownerRoomPlayerId: 'room-player-1',
    });
  });

  it('rejects buying without pending decision', () => {
    const state = createGameEngineState({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });

    expect(() =>
      buyProperty(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'NO_PROPERTY_DECISION',
        'There is no property decision to resolve',
      ),
    );
  });

  it('rejects buying non-ownable tiles', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: 'chance_1',
    });

    expect(() =>
      buyProperty(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(new GameEngineError('TILE_NOT_OWNABLE', 'Tile cannot be bought'));
  });

  it('rejects buying already owned tiles', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: TEST_BOARD_TILES.cheapProperty,
    });

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== TEST_BOARD_TILES.cheapProperty) {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    expect(() =>
      buyProperty(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'PROPERTY_ALREADY_OWNED',
        'Property is already owned',
      ),
    );
  });

  it('rejects buying without enough cash', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
      pendingTileKey: 'australia',
      players: [
        createGameEngineState().players[0],
        createGameEngineState().players[1],
        createGameEngineState().players[2],
      ],
    });

    state.players[0].cash = 399;

    expect(() =>
      buyProperty(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'INSUFFICIENT_FUNDS',
        'Player does not have enough cash',
      ),
    );
  });
});

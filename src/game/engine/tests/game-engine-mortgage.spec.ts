import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState, TEST_BOARD_TILES } from './game-engine.test-factory';

describe('game-engine-mortgage', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('mortgages owned property', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
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

    const result = service.mortgageProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: TEST_BOARD_TILES.cheapProperty,
    });

    expect(result.state.players[0].cash).toBe(1530);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      mortgaged: true,
    });
    expect(result.events).toEqual([
      {
        type: 'property_mortgaged',
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
        amount: 30,
      },
    ]);
  });

  it('mortgages airports and utilities', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (
          property.tileKey === TEST_BOARD_TILES.airport ||
          property.tileKey === TEST_BOARD_TILES.utility
        ) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const mortgagedAirport = service.mortgageProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: TEST_BOARD_TILES.airport,
    });

    const mortgagedUtility = service.mortgageProperty(mortgagedAirport.state, {
      roomPlayerId: 'room-player-1',
      tileKey: TEST_BOARD_TILES.utility,
    });

    expect(mortgagedUtility.state.players[0].cash).toBe(1675);
    expect(
      mortgagedUtility.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.airport,
      ),
    ).toMatchObject({
      mortgaged: true,
    });
    expect(
      mortgagedUtility.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.utility,
      ),
    ).toMatchObject({
      mortgaged: true,
    });
  });

  it('rejects mortgage when player is not owner', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-2',
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.mortgageProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects mortgage on sets with buildings', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        if (property.tileKey === TEST_BOARD_TILES.cheapPropertyPair) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 1,
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.mortgageProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      }),
    ).toThrow(GameEngineError);
  });

  it('unmortgages owned property', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            mortgaged: true,
          };
        }

        return property;
      }),
    });

    const result = service.unmortgageProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: TEST_BOARD_TILES.cheapProperty,
    });

    expect(result.state.players[0].cash).toBe(1467);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === TEST_BOARD_TILES.cheapProperty,
      ),
    ).toMatchObject({
      mortgaged: false,
    });
    expect(result.events).toEqual([
      {
        type: 'property_unmortgaged',
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
        amount: 33,
      },
    ]);
  });

  it('rejects unmortgage when property is not mortgaged', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === TEST_BOARD_TILES.cheapProperty) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            mortgaged: false,
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.unmortgageProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects mortgage actions during property decision', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
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

    expect(() =>
      service.mortgageProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: TEST_BOARD_TILES.cheapProperty,
      }),
    ).toThrow(GameEngineError);
  });
});

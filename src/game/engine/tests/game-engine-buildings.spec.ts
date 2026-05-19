import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-buildings', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('builds a house when player owns the full set', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria' || property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    const result = service.buildProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1450);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      houseCount: 1,
      hasHotel: false,
    });
    expect(result.events).toEqual([
      {
        type: 'property_house_built',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        houseCount: 1,
        amount: 50,
      },
    ]);
  });

  it('rejects building when player does not own the full set', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.buildProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects uneven house building', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 1,
          };
        }

        if (property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 0,
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.buildProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });

  it('upgrades four houses to a hotel', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria' || property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 4,
          };
        }

        return property;
      }),
    });

    const result = service.buildProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1450);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      houseCount: 0,
      hasHotel: true,
    });
    expect(result.events).toEqual([
      {
        type: 'property_hotel_built',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        amount: 50,
      },
    ]);
  });

  it('sells a house and credits half the build cost', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria' || property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 1,
          };
        }

        return property;
      }),
    });

    const result = service.sellBuilding(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1525);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      houseCount: 0,
      hasHotel: false,
    });
    expect(result.events).toEqual([
      {
        type: 'property_house_sold',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        houseCount: 0,
        amount: 25,
      },
    ]);
  });

  it('sells a hotel back to four houses', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 0,
            hasHotel: true,
          };
        }

        if (property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 4,
          };
        }

        return property;
      }),
    });

    const result = service.sellBuilding(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1525);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      houseCount: 4,
      hasHotel: false,
    });
    expect(result.events).toEqual([
      {
        type: 'property_hotel_sold',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        amount: 25,
      },
    ]);
  });

  it('rejects building on airports and utilities', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
    });

    expect(() =>
      service.buildProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'lagos_airport',
      }),
    ).toThrow(GameEngineError);

    expect(() =>
      service.buildProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'electric_company',
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects building when any property in the set is mortgaged', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            mortgaged: true,
          };
        }

        if (property.tileKey === 'ghana') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    expect(() =>
      service.buildProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'ghana',
      }),
    ).toThrow(GameEngineError);
  });
});

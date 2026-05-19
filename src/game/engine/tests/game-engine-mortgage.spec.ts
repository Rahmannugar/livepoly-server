import { GameEngineService } from '../game-engine.service';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-mortgage', () => {
  let service: GameEngineService;

  beforeEach(() => {
    service = new GameEngineService();
  });

  it('mortgages an owned property and credits mortgage value', () => {
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

    const result = service.mortgageProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1530);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      mortgaged: true,
    });
    expect(result.events).toEqual([
      {
        type: 'property_mortgaged',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        amount: 30,
      },
    ]);
  });

  it('mortgages airports and utilities', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (
          property.tileKey === 'lagos_airport' ||
          property.tileKey === 'electric_company'
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
      tileKey: 'lagos_airport',
    });

    const mortgagedUtility = service.mortgageProperty(mortgagedAirport.state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'electric_company',
    });

    expect(mortgagedUtility.state.players[0].cash).toBe(1675);
    expect(
      mortgagedUtility.state.properties.find(
        (property) => property.tileKey === 'lagos_airport',
      ),
    ).toMatchObject({
      mortgaged: true,
    });
    expect(
      mortgagedUtility.state.properties.find(
        (property) => property.tileKey === 'electric_company',
      ),
    ).toMatchObject({
      mortgaged: true,
    });
  });

  it('rejects mortgage when player is not owner', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
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
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects mortgage when any property in the set has buildings', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        if (property.tileKey === 'ghana') {
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
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });

  it('unmortgages an owned property and debits mortgage value plus interest', () => {
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

        return property;
      }),
    });

    const result = service.unmortgageProperty(state, {
      roomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
    });

    expect(result.state.players[0].cash).toBe(1467);
    expect(
      result.state.properties.find(
        (property) => property.tileKey === 'nigeria',
      ),
    ).toMatchObject({
      mortgaged: false,
    });
    expect(result.events).toEqual([
      {
        type: 'property_unmortgaged',
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
        amount: 33,
      },
    ]);
  });

  it('rejects unmortgage when property is not mortgaged', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
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
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });

  it('rejects mortgage actions during property decision', () => {
    const state = createGameEngineState({
      phase: 'awaiting_property_decision',
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
      service.mortgageProperty(state, {
        roomPlayerId: 'room-player-1',
        tileKey: 'nigeria',
      }),
    ).toThrow(GameEngineError);
  });
});

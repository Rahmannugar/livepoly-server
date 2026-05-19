import { CLASSIC_GAME_BOARD } from '../game-board';
import { calculateRent, payRent } from '../game-engine-rent';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-rent', () => {
  it('pays base property rent to the owner', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const result = payRent(state, {
      payerRoomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
      dice: [1, 1],
    });

    expect(result.state.players[0].cash).toBe(1498);
    expect(result.state.players[1].cash).toBe(1502);
    expect(result.events).toEqual([
      {
        type: 'rent_paid',
        payerRoomPlayerId: 'room-player-1',
        ownerRoomPlayerId: 'room-player-2',
        tileKey: 'nigeria',
        amount: 2,
      },
    ]);
  });

  it('doubles base rent when the owner owns the full property set with no buildings', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria' && property.tileKey !== 'ghana') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const nigeria = CLASSIC_GAME_BOARD.tiles.find(
      (tile) => tile.key === 'nigeria',
    );

    if (!nigeria || nigeria.kind !== 'property') {
      throw new Error('Missing Nigeria property tile');
    }

    expect(calculateRent(state, nigeria, [1, 1])).toBe(4);
  });

  it('uses house rent for built property', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
        houseCount: 2,
      };
    });

    const nigeria = CLASSIC_GAME_BOARD.tiles.find(
      (tile) => tile.key === 'nigeria',
    );

    if (!nigeria || nigeria.kind !== 'property') {
      throw new Error('Missing Nigeria property tile');
    }

    expect(calculateRent(state, nigeria, [1, 1])).toBe(30);
  });

  it('uses hotel rent for hotel property', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
        hasHotel: true,
      };
    });

    const nigeria = CLASSIC_GAME_BOARD.tiles.find(
      (tile) => tile.key === 'nigeria',
    );

    if (!nigeria || nigeria.kind !== 'property') {
      throw new Error('Missing Nigeria property tile');
    }

    expect(calculateRent(state, nigeria, [1, 1])).toBe(250);
  });

  it('charges airport rent by owned airport count', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (
        property.tileKey !== 'lagos_airport' &&
        property.tileKey !== 'new_york_airport'
      ) {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const airport = CLASSIC_GAME_BOARD.tiles.find(
      (tile) => tile.key === 'lagos_airport',
    );

    if (!airport || airport.kind !== 'airport') {
      throw new Error('Missing Lagos Airport tile');
    }

    expect(calculateRent(state, airport, [1, 1])).toBe(50);
  });

  it('charges utility rent by dice and owned utility count', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (
        property.tileKey !== 'electric_company' &&
        property.tileKey !== 'water_works'
      ) {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const utility = CLASSIC_GAME_BOARD.tiles.find(
      (tile) => tile.key === 'electric_company',
    );

    if (!utility || utility.kind !== 'utility') {
      throw new Error('Missing Electric Company tile');
    }

    expect(calculateRent(state, utility, [3, 4])).toBe(70);
  });

  it('does not charge rent for self-owned property', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-1',
      };
    });

    const result = payRent(state, {
      payerRoomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
      dice: [1, 1],
    });

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('does not charge rent for mortgaged property', () => {
    const state = createGameEngineState();

    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
        mortgaged: true,
      };
    });

    const result = payRent(state, {
      payerRoomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
      dice: [1, 1],
    });

    expect(result.state).toBe(state);
    expect(result.events).toEqual([]);
  });

  it('creates debt when player cannot afford rent', () => {
    const state = createGameEngineState();

    state.players[0].cash = 1;
    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const result = payRent(state, {
      payerRoomPlayerId: 'room-player-1',
      tileKey: 'nigeria',
      dice: [1, 1],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 2,
        reason: 'rent',
      },
    });
    expect(result.events).toEqual([
      {
        type: 'payment_required',
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 2,
        reason: 'rent',
      },
    ]);
  });
});

import {
  calculateNetWorthStandings,
  canPlayerAct,
  getActivePlayers,
  getOwnedProperties,
  getPlayerByRoomPlayerId,
  getPropertyByTileKey,
  getTileOwnerRoomPlayerId,
  isGameTerminal,
} from '../game-engine-derived-state';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-derived-state', () => {
  it('returns active players in seat order', () => {
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

    expect(
      getActivePlayers(state).map((player) => player.roomPlayerId),
    ).toEqual(['room-player-1', 'room-player-3']);
  });

  it('gets player by room player id', () => {
    const state = createGameEngineState();

    expect(getPlayerByRoomPlayerId(state, 'room-player-2')).toMatchObject({
      roomPlayerId: 'room-player-2',
      username: 'playertwo',
    });
  });

  it('throws when player does not exist', () => {
    expect(() =>
      getPlayerByRoomPlayerId(createGameEngineState(), 'missing-player'),
    ).toThrow(GameEngineError);
  });

  it('gets property by tile key', () => {
    const state = createGameEngineState();

    expect(getPropertyByTileKey(state, 'nigeria')).toMatchObject({
      tileKey: 'nigeria',
      ownerRoomPlayerId: null,
    });
  });

  it('gets tile owner room player id', () => {
    const state = createGameEngineState({
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

    expect(getTileOwnerRoomPlayerId(state, 'nigeria')).toBe('room-player-1');
  });

  it('gets owned properties for a player', () => {
    const state = createGameEngineState({
      properties: createGameEngineState().properties.map((property) => {
        if (
          property.tileKey === 'nigeria' ||
          property.tileKey === 'lagos_airport'
        ) {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
          };
        }

        return property;
      }),
    });

    expect(
      getOwnedProperties(state, 'room-player-1').map(
        (property) => property.tileKey,
      ),
    ).toEqual(['nigeria', 'lagos_airport']);
  });

  it('returns whether player can act', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      currentTurnRoomPlayerId: 'room-player-1',
    });

    expect(canPlayerAct(state, 'room-player-1')).toBe(true);
    expect(canPlayerAct(state, 'room-player-2')).toBe(false);
  });

  it('returns false for action checks when game is terminal', () => {
    const state = createGameEngineState({
      phase: 'finished',
      currentTurnRoomPlayerId: 'room-player-1',
    });

    expect(canPlayerAct(state, 'room-player-1')).toBe(false);
  });

  it('detects terminal game state', () => {
    expect(
      isGameTerminal(
        createGameEngineState({
          phase: 'finished',
        }),
      ),
    ).toBe(true);

    expect(
      isGameTerminal(
        createGameEngineState({
          phase: 'awaiting_roll',
        }),
      ),
    ).toBe(false);
  });

  it('calculates net worth standings', () => {
    const state = createGameEngineState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            cash: 100,
          };
        }

        if (player.roomPlayerId === 'room-player-3') {
          return {
            ...player,
            bankrupt: true,
            cash: 9999,
          };
        }

        return player;
      }),
      properties: createGameEngineState().properties.map((property) => {
        if (property.tileKey === 'nigeria') {
          return {
            ...property,
            ownerRoomPlayerId: 'room-player-1',
            houseCount: 2,
          };
        }

        return property;
      }),
    });

    expect(calculateNetWorthStandings(state)).toEqual([
      {
        roomPlayerId: 'room-player-2',
        seatNumber: 2,
        cash: 1500,
        assetValue: 0,
        netWorth: 1500,
      },
      {
        roomPlayerId: 'room-player-1',
        seatNumber: 1,
        cash: 100,
        assetValue: 110,
        netWorth: 210,
      },
    ]);
  });
});

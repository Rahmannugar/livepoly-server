import { GameEngineService } from '../game-engine.service';
import {
  createGameEngineProperty,
  createGameEnginePlayer,
  createGameEngineState,
  TEST_BOARD_TILES,
} from './game-engine.test-factory';

describe('automatic debt resolution', () => {
  const engine = new GameEngineService();

  it('mortgages properties and pays debt before considering bankruptcy', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 50,
        reason: 'rent',
      },
      players: [
        createGameEnginePlayer({ cash: 0 }),
        ...createGameEngineState().players.slice(1),
      ],
      properties: [
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapProperty,
          ownerRoomPlayerId: 'room-player-1',
        }),
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapPropertyPair,
          ownerRoomPlayerId: 'room-player-1',
        }),
      ],
    });

    const result = engine.autoResolveDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.phase).toBe('awaiting_turn_end');
    expect(result.state.debt).toBeNull();
    expect(result.state.players[0]).toMatchObject({
      cash: 10,
      bankrupt: false,
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'property_mortgaged',
      'property_mortgaged',
      'debt_paid',
    ]);
  });

  it('sells buildings before mortgaging properties', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 20,
        reason: 'tax',
      },
      players: [
        createGameEnginePlayer({ cash: 0 }),
        ...createGameEngineState().players.slice(1),
      ],
      properties: [
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapProperty,
          ownerRoomPlayerId: 'room-player-1',
          houseCount: 1,
        }),
        createGameEngineProperty({
          tileKey: TEST_BOARD_TILES.cheapPropertyPair,
          ownerRoomPlayerId: 'room-player-1',
        }),
      ],
    });

    const result = engine.autoResolveDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0]).toMatchObject({ cash: 5, bankrupt: false });
    expect(result.events.map((event) => event.type)).toEqual([
      'property_house_sold',
      'debt_paid',
    ]);
  });

  it('declares bankruptcy only after legal liquidation is exhausted', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 100,
        reason: 'rent',
      },
      players: [
        createGameEnginePlayer({ cash: 0 }),
        ...createGameEngineState().players.slice(1),
      ],
      properties: [],
    });

    const result = engine.autoResolveDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0].bankrupt).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(
      'player_bankrupt',
    );
  });
});

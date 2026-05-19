import { rollAndMove } from '../game-engine-movement';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-movement', () => {
  it('moves a player and emits movement and landing events', () => {
    const result = rollAndMove(createGameEngineState(), {
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      lastDiceRoll: [3, 4],
    });
    expect(result.state.players[0]).toMatchObject({
      roomPlayerId: 'room-player-1',
      position: 7,
      cash: 1500,
    });
    expect(result.events).toEqual([
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 0,
        toPosition: 7,
        dice: [3, 4],
      },
      {
        type: 'player_landed_on_tile',
        roomPlayerId: 'room-player-1',
        tileKey: 'chance_1',
        tileKind: 'chance',
      },
    ]);
  });

  it('pays pass-go cash and emits a pass-go event', () => {
    const state = createGameEngineState();
    state.players[0].position = 38;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [3, 2],
    });

    expect(result.state.players[0]).toMatchObject({
      position: 3,
      cash: 1700,
    });
    expect(result.events).toEqual([
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 38,
        toPosition: 3,
        dice: [3, 2],
      },
      {
        type: 'player_passed_go',
        roomPlayerId: 'room-player-1',
        amount: 200,
      },
      {
        type: 'player_landed_on_tile',
        roomPlayerId: 'room-player-1',
        tileKey: 'ghana',
        tileKind: 'property',
      },
    ]);
  });

  it('waits for a property decision after landing on an unowned ownable tile', () => {
    const state = createGameEngineState();
    state.players[0].position = 39;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 1],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_property_decision',
      pendingTileKey: 'nigeria',
    });
    expect(result.state.players[0]).toMatchObject({
      position: 1,
      cash: 1700,
    });
  });

  it('charges rent after landing on another player owned property', () => {
    const state = createGameEngineState();
    state.players[0].position = 39;
    state.properties = state.properties.map((property) => {
      if (property.tileKey !== 'nigeria') {
        return property;
      }

      return {
        ...property,
        ownerRoomPlayerId: 'room-player-2',
      };
    });

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 1],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(result.state.players[0].cash).toBe(1698);
    expect(result.state.players[1].cash).toBe(1502);
    expect(result.events).toContainEqual({
      type: 'rent_paid',
      payerRoomPlayerId: 'room-player-1',
      ownerRoomPlayerId: 'room-player-2',
      tileKey: 'nigeria',
      amount: 2,
    });
  });

  it('does not wait for a property decision when the ownable tile is already owned', () => {
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
    state.players[0].position = 39;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 1],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
  });
});

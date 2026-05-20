import { rollAndMove } from '../game-engine-movement';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-movement', () => {
  it('moves player and applies chance card', () => {
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
      cash: 1550,
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
      {
        type: 'card_drawn',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
      },
      {
        type: 'card_applied',
        roomPlayerId: 'room-player-1',
        deckKey: 'chance',
        cardKey: 'chance_bank_dividend',
        effectType: 'collect_money',
      },
    ]);
  });

  it('pays cash after passing go', () => {
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

  it('waits for decision on unowned property', () => {
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

  it('charges rent on owned property', () => {
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

  it('skips property decision for owned property', () => {
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

  it('sends player to jail from go to jail tile', () => {
    const state = createGameEngineState();
    state.players[0].position = 28;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [1, 1],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(result.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurnCount: 0,
    });
    expect(result.events).toContainEqual({
      type: 'player_sent_to_jail',
      roomPlayerId: 'room-player-1',
      jailPosition: 10,
    });
  });

  it('grants another turn after doubles', () => {
    const result = rollAndMove(createGameEngineState(), {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });

    expect(result.state).toMatchObject({
      consecutiveDoublesCount: 1,
      shouldCurrentPlayerPlayAgain: true,
    });
    expect(result.events).toContainEqual({
      type: 'player_rolled_doubles',
      roomPlayerId: 'room-player-1',
      consecutiveDoublesCount: 1,
    });
  });

  it('sends player to jail after third doubles', () => {
    const result = rollAndMove(
      createGameEngineState({
        consecutiveDoublesCount: 2,
      }),
      {
        roomPlayerId: 'room-player-1',
        dice: [3, 3],
      },
    );

    expect(result.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
    });
    expect(result.state).toMatchObject({
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      phase: 'awaiting_turn_end',
    });
    expect(result.events).toEqual([
      {
        type: 'player_rolled_doubles',
        roomPlayerId: 'room-player-1',
        consecutiveDoublesCount: 3,
      },
      {
        type: 'player_rolled_third_doubles',
        roomPlayerId: 'room-player-1',
      },
      {
        type: 'player_sent_to_jail',
        roomPlayerId: 'room-player-1',
        jailPosition: 10,
      },
    ]);
  });

  it('releases jailed player after rolling doubles', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 1;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });

    expect(result.state.players[0]).toMatchObject({
      position: 14,
      inJail: false,
      jailTurnCount: 0,
    });
    expect(result.state).toMatchObject({
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
    });
    expect(result.events).toContainEqual({
      type: 'jail_escape_roll_succeeded',
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });
  });

  it('keeps jailed player after failed doubles roll', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 1;

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 3],
    });

    expect(result.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurnCount: 2,
    });
    expect(result.events).toEqual([
      {
        type: 'jail_escape_roll_failed',
        roomPlayerId: 'room-player-1',
        dice: [2, 3],
        jailTurnCount: 2,
      },
    ]);
  });
});

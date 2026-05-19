import { rollAndMove } from '../game-engine-movement';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-tax', () => {
  it('charges tax when player lands on a tax tile', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
    });

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });

    expect(result.state.players[0].cash).toBe(1300);
    expect(result.state.phase).toBe('awaiting_turn_end');
    expect(result.events).toContainEqual({
      type: 'tax_paid',
      roomPlayerId: 'room-player-1',
      tileKey: 'income_tax',
      amount: 200,
    });
  });

  it('creates debt when player cannot pay tax', () => {
    const state = createGameEngineState({
      phase: 'awaiting_roll',
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            cash: 50,
          };
        }

        return player;
      }),
    });

    const result = rollAndMove(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 200,
        reason: 'tax',
      },
    });
    expect(result.events).toContainEqual({
      type: 'payment_required',
      roomPlayerId: 'room-player-1',
      creditorRoomPlayerId: null,
      amount: 200,
      reason: 'tax',
    });
  });
});

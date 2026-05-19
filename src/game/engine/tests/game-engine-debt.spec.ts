import { payDebt } from '../game-engine-debt';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-debt', () => {
  it('pays bank debt and returns game to turn end', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 200,
        reason: 'tax',
      },
    });

    const result = payDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      debt: null,
    });
    expect(result.state.players[0].cash).toBe(1300);
    expect(result.events).toEqual([
      {
        type: 'debt_paid',
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 200,
        reason: 'tax',
      },
    ]);
  });

  it('pays creditor debt and transfers cash', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 300,
        reason: 'rent',
      },
    });

    const result = payDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0].cash).toBe(1200);
    expect(result.state.players[1].cash).toBe(1800);
    expect(result.events).toEqual([
      {
        type: 'debt_paid',
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: 'room-player-2',
        amount: 300,
        reason: 'rent',
      },
    ]);
  });

  it('releases player from jail after paying jail fine debt', () => {
    const state = createGameEngineState({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 50,
        reason: 'jail_fine',
      },
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-1') {
          return {
            ...player,
            inJail: true,
            jailTurnCount: 3,
          };
        }

        return player;
      }),
    });

    const result = payDebt(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0]).toMatchObject({
      inJail: false,
      jailTurnCount: 0,
    });
    expect(result.events).toEqual([
      {
        type: 'debt_paid',
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: 50,
        reason: 'jail_fine',
      },
      {
        type: 'player_released_from_jail',
        roomPlayerId: 'room-player-1',
      },
    ]);
  });

  it('rejects paying debt when there is no active debt', () => {
    expect(() =>
      payDebt(createGameEngineState(), {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(new GameEngineError('NO_ACTIVE_DEBT', 'There is no active debt'));
  });
});

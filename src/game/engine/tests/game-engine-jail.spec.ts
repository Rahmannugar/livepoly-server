import {
  JAIL_FINE_AMOUNT,
  payJailFine,
  resolveJailedRoll,
  sendPlayerToJail,
} from '../game-engine-jail';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-jail', () => {
  it('sends a player to jail', () => {
    const result = sendPlayerToJail(createGameEngineState(), 'room-player-1');

    expect(result.state).toMatchObject({
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
    });
    expect(result.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurnCount: 0,
    });
    expect(result.events).toEqual([
      {
        type: 'player_sent_to_jail',
        roomPlayerId: 'room-player-1',
        jailPosition: 10,
      },
    ]);
  });

  it('lets a jailed player pay fine and leave jail', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].jailTurnCount = 1;

    const result = payJailFine(state, {
      roomPlayerId: 'room-player-1',
    });

    expect(result.state.players[0]).toMatchObject({
      cash: 1500 - JAIL_FINE_AMOUNT,
      inJail: false,
      jailTurnCount: 0,
    });
    expect(result.events).toEqual([
      {
        type: 'jail_fine_paid',
        roomPlayerId: 'room-player-1',
        amount: JAIL_FINE_AMOUNT,
      },
      {
        type: 'player_released_from_jail',
        roomPlayerId: 'room-player-1',
      },
    ]);
  });

  it('rejects paying jail fine when player is not in jail', () => {
    expect(() =>
      payJailFine(createGameEngineState(), {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'PLAYER_NOT_IN_JAIL',
        'Player is not currently in jail',
      ),
    );
  });

  it('rejects paying jail fine without enough cash', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].cash = JAIL_FINE_AMOUNT - 1;

    expect(() =>
      payJailFine(state, {
        roomPlayerId: 'room-player-1',
      }),
    ).toThrow(
      new GameEngineError(
        'INSUFFICIENT_FUNDS',
        'Player does not have enough cash',
      ),
    );
  });

  it('releases and moves jailed player after rolling doubles', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 1;

    const result = resolveJailedRoll(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 2],
      moveReleasedPlayer: (releasedState) => ({
        state: {
          ...releasedState,
          players: releasedState.players.map((player) => {
            if (player.roomPlayerId !== 'room-player-1') return player;

            return {
              ...player,
              position: 14,
            };
          }),
        },
        events: [
          {
            type: 'player_moved',
            roomPlayerId: 'room-player-1',
            fromPosition: 10,
            toPosition: 14,
            dice: [2, 2],
          },
        ],
      }),
    });

    expect(result?.state.players[0]).toMatchObject({
      position: 14,
      inJail: false,
      jailTurnCount: 0,
    });
    expect(result?.state).toMatchObject({
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
    });
    expect(result?.events).toEqual([
      {
        type: 'jail_escape_roll_succeeded',
        roomPlayerId: 'room-player-1',
        dice: [2, 2],
      },
      {
        type: 'player_released_from_jail',
        roomPlayerId: 'room-player-1',
      },
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 10,
        toPosition: 14,
        dice: [2, 2],
      },
    ]);
  });

  it('keeps player in jail after failed doubles attempt', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 1;

    const result = resolveJailedRoll(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 3],
      moveReleasedPlayer: jest.fn(),
    });

    expect(result?.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurnCount: 2,
    });
    expect(result?.events).toEqual([
      {
        type: 'jail_escape_roll_failed',
        roomPlayerId: 'room-player-1',
        dice: [2, 3],
        jailTurnCount: 2,
      },
    ]);
  });

  it('forces fine payment and moves player after third failed jail roll', () => {
    const state = createGameEngineState();

    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 2;

    const result = resolveJailedRoll(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 3],
      moveReleasedPlayer: (releasedState) => ({
        state: {
          ...releasedState,
          players: releasedState.players.map((player) => {
            if (player.roomPlayerId !== 'room-player-1') return player;

            return {
              ...player,
              position: 15,
            };
          }),
        },
        events: [
          {
            type: 'player_moved',
            roomPlayerId: 'room-player-1',
            fromPosition: 10,
            toPosition: 15,
            dice: [2, 3],
          },
        ],
      }),
    });

    expect(result?.state.players[0]).toMatchObject({
      position: 15,
      cash: 1500 - JAIL_FINE_AMOUNT,
      inJail: false,
      jailTurnCount: 0,
    });
    expect(result?.events).toEqual([
      {
        type: 'jail_escape_roll_failed',
        roomPlayerId: 'room-player-1',
        dice: [2, 3],
        jailTurnCount: 3,
      },
      {
        type: 'jail_forced_fine_paid',
        roomPlayerId: 'room-player-1',
        amount: JAIL_FINE_AMOUNT,
      },
      {
        type: 'player_released_from_jail',
        roomPlayerId: 'room-player-1',
      },
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 10,
        toPosition: 15,
        dice: [2, 3],
      },
    ]);
  });

  it('creates debt when player cannot pay forced jail fine', () => {
    const state = createGameEngineState();

    state.players[0].cash = JAIL_FINE_AMOUNT - 1;
    state.players[0].inJail = true;
    state.players[0].position = 10;
    state.players[0].jailTurnCount = 2;

    const result = resolveJailedRoll(state, {
      roomPlayerId: 'room-player-1',
      dice: [2, 3],
      moveReleasedPlayer: jest.fn(),
    });

    expect(result?.state).toMatchObject({
      phase: 'awaiting_debt_resolution',
      debt: {
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: JAIL_FINE_AMOUNT,
        reason: 'jail_fine',
      },
    });
    expect(result?.state.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurnCount: 3,
    });
    expect(result?.events).toEqual([
      {
        type: 'jail_escape_roll_failed',
        roomPlayerId: 'room-player-1',
        dice: [2, 3],
        jailTurnCount: 3,
      },
      {
        type: 'payment_required',
        roomPlayerId: 'room-player-1',
        creditorRoomPlayerId: null,
        amount: JAIL_FINE_AMOUNT,
        reason: 'jail_fine',
      },
    ]);
  });
});

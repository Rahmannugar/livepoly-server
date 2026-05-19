import { getGameBoard } from './game-board';
import { cloneDiceRoll } from './game-engine-cloner';
import { isDoubles } from './game-engine-dice';
import { debitPlayer } from './game-engine-money';
import {
  GameEngineError,
  type DiceRoll,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type PayJailFineInput,
} from './game-engine.types';

export const JAIL_FINE_AMOUNT = 50;
export const MAX_JAIL_TURN_COUNT = 3;

export function sendPlayerToJail(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineResult {
  const board = getGameBoard(state.boardKey);

  return {
    state: {
      ...state,
      phase: 'awaiting_turn_end',
      pendingTileKey: null,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      players: state.players.map((player) => {
        if (player.roomPlayerId !== roomPlayerId) {
          return player;
        }

        return {
          ...player,
          position: board.jailPosition,
          inJail: true,
          jailTurnCount: 0,
        };
      }),
    },
    events: [
      {
        type: 'player_sent_to_jail',
        roomPlayerId,
        jailPosition: board.jailPosition,
      },
    ],
  };
}

export function resolveJailedRoll(
  state: GameEngineState,
  input: {
    roomPlayerId: string;
    dice: DiceRoll;
    moveReleasedPlayer: (releasedState: GameEngineState) => GameEngineResult;
  },
): GameEngineResult | null {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === input.roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  if (!player.inJail) {
    return null;
  }

  if (isDoubles(input.dice)) {
    const releasedState = releasePlayerFromJail(state, input.roomPlayerId);
    const moveResult = input.moveReleasedPlayer({
      ...releasedState,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
    });

    return {
      state: {
        ...moveResult.state,
        consecutiveDoublesCount: 0,
        shouldCurrentPlayerPlayAgain: false,
      },
      events: [
        {
          type: 'jail_escape_roll_succeeded',
          roomPlayerId: input.roomPlayerId,
          dice: cloneDiceRoll(input.dice),
        },
        {
          type: 'player_released_from_jail',
          roomPlayerId: input.roomPlayerId,
        },
        ...moveResult.events,
      ],
    };
  }

  const jailTurnCount = player.jailTurnCount + 1;

  if (jailTurnCount >= MAX_JAIL_TURN_COUNT) {
    const debitedState = debitPlayer(
      state,
      input.roomPlayerId,
      JAIL_FINE_AMOUNT,
    );
    const releasedState = releasePlayerFromJail(
      {
        ...debitedState,
        players: debitedState.players.map((candidate) => {
          if (candidate.roomPlayerId !== input.roomPlayerId) {
            return candidate;
          }

          return {
            ...candidate,
            jailTurnCount,
          };
        }),
      },
      input.roomPlayerId,
    );
    const moveResult = input.moveReleasedPlayer(releasedState);

    return {
      state: {
        ...moveResult.state,
        consecutiveDoublesCount: 0,
        shouldCurrentPlayerPlayAgain: false,
      },
      events: [
        {
          type: 'jail_escape_roll_failed',
          roomPlayerId: input.roomPlayerId,
          dice: cloneDiceRoll(input.dice),
          jailTurnCount,
        },
        {
          type: 'jail_forced_fine_paid',
          roomPlayerId: input.roomPlayerId,
          amount: JAIL_FINE_AMOUNT,
        },
        {
          type: 'player_released_from_jail',
          roomPlayerId: input.roomPlayerId,
        },
        ...moveResult.events,
      ],
    };
  }

  return {
    state: {
      ...state,
      phase: 'awaiting_turn_end',
      lastDiceRoll: cloneDiceRoll(input.dice),
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      players: state.players.map((candidate) => {
        if (candidate.roomPlayerId !== input.roomPlayerId) {
          return candidate;
        }

        return {
          ...candidate,
          jailTurnCount,
        };
      }),
    },
    events: [
      {
        type: 'jail_escape_roll_failed',
        roomPlayerId: input.roomPlayerId,
        dice: cloneDiceRoll(input.dice),
        jailTurnCount,
      },
    ],
  };
}

export function payJailFine(
  state: GameEngineState,
  input: PayJailFineInput,
): GameEngineResult {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === input.roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  if (!player.inJail) {
    throw new GameEngineError(
      'PLAYER_NOT_IN_JAIL',
      'Player is not currently in jail',
    );
  }

  const debitedState = debitPlayer(state, input.roomPlayerId, JAIL_FINE_AMOUNT);

  return {
    state: releasePlayerFromJail(debitedState, input.roomPlayerId),
    events: [
      {
        type: 'jail_fine_paid',
        roomPlayerId: input.roomPlayerId,
        amount: JAIL_FINE_AMOUNT,
      },
      {
        type: 'player_released_from_jail',
        roomPlayerId: input.roomPlayerId,
      },
    ],
  };
}

function releasePlayerFromJail(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineState {
  return {
    ...state,
    players: state.players.map((candidate) => {
      if (candidate.roomPlayerId !== roomPlayerId) {
        return candidate;
      }

      return {
        ...candidate,
        inJail: false,
        jailTurnCount: 0,
      };
    }),
  };
}

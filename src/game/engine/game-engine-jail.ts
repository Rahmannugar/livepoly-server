import { getGameBoard } from './game-board';
import { returnGetOutOfJailCardToDeck } from './game-engine-cards';
import { cloneDiceRoll } from './game-engine-cloner';
import { isDoubles } from './game-engine-dice';
import { debitPlayer, debitPlayerOrCreateDebt } from './game-engine-money';
import {
  GameEngineError,
  type DiceRoll,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type PayJailFineInput,
  type UseGetOutOfJailCardInput,
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
    const paymentResult = debitPlayerOrCreateDebt(state, {
      roomPlayerId: input.roomPlayerId,
      amount: JAIL_FINE_AMOUNT,
      reason: 'jail_fine',
    });

    if (!paymentResult.paid) {
      return {
        state: {
          ...paymentResult.state,
          lastDiceRoll: cloneDiceRoll(input.dice),
          players: paymentResult.state.players.map((candidate) => {
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
          ...paymentResult.events,
        ],
      };
    }

    const debitedState = paymentResult.state;
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

export function useGetOutOfJailCard(
  state: GameEngineState,
  input: UseGetOutOfJailCardInput,
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

  if (player.getOutOfJailFreeCards <= 0) {
    throw new GameEngineError(
      'GET_OUT_OF_JAIL_CARD_REQUIRED',
      'Player does not have a Get Out of Jail Free card',
    );
  }

  const [cardKey, ...remainingCardKeys] = player.getOutOfJailFreeCardKeys ?? [];
  const returnedState = returnGetOutOfJailCardToDeck(state, cardKey ?? null);

  return {
    state: releasePlayerFromJail(
      {
        ...returnedState,
        players: returnedState.players.map((candidate) => {
          if (candidate.roomPlayerId !== input.roomPlayerId) {
            return candidate;
          }

          return {
            ...candidate,
            getOutOfJailFreeCards: candidate.getOutOfJailFreeCards - 1,
            getOutOfJailFreeCardKeys: remainingCardKeys,
          };
        }),
      },
      input.roomPlayerId,
    ),
    events: [
      {
        type: 'get_out_of_jail_card_used',
        roomPlayerId: input.roomPlayerId,
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

import { debitPlayer, transferPlayerCash } from './game-engine-money';
import {
  GameEngineError,
  type GameEngineEvent,
  type GameEngineResult,
  type GameEngineState,
  type PayDebtInput,
} from './game-engine.types';

export function payDebt(
  state: GameEngineState,
  input: PayDebtInput,
): GameEngineResult {
  if (state.phase !== 'awaiting_debt_resolution' || !state.debt) {
    throw new GameEngineError('NO_ACTIVE_DEBT', 'There is no active debt');
  }

  if (state.debt.roomPlayerId !== input.roomPlayerId) {
    throw new GameEngineError(
      'DEBT_RESOLUTION_REQUIRED',
      'Only the indebted player can resolve this debt',
    );
  }

  const paidState = state.debt.creditorRoomPlayerId
    ? transferPlayerCash(
        state,
        input.roomPlayerId,
        state.debt.creditorRoomPlayerId,
        state.debt.amount,
      )
    : debitPlayer(state, input.roomPlayerId, state.debt.amount);
  const releasedFromJail = state.debt.reason === 'jail_fine';
  const nextState = releasedFromJail
    ? releasePlayerFromJail(paidState, input.roomPlayerId)
    : paidState;
  const events: GameEngineEvent[] = [
    {
      type: 'debt_paid',
      roomPlayerId: input.roomPlayerId,
      creditorRoomPlayerId: state.debt.creditorRoomPlayerId,
      amount: state.debt.amount,
      reason: state.debt.reason,
    },
  ];

  if (releasedFromJail) {
    events.push({
      type: 'player_released_from_jail',
      roomPlayerId: input.roomPlayerId,
    });
  }

  return {
    state: {
      ...nextState,
      phase: 'awaiting_turn_end',
      debt: null,
      pendingTileKey: null,
      auction: null,
      shouldCurrentPlayerPlayAgain: false,
    },
    events,
  };
}

function releasePlayerFromJail(
  state: GameEngineState,
  roomPlayerId: string,
): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.roomPlayerId !== roomPlayerId) {
        return player;
      }

      return {
        ...player,
        inJail: false,
        jailTurnCount: 0,
      };
    }),
  };
}

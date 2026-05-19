import {
  GameEngineError,
  type GameEngineDebtReason,
  type GameEngineEvent,
  type GameEnginePlayer,
  type GameEngineState,
} from './game-engine.types';

export function debitPlayer(
  state: GameEngineState,
  roomPlayerId: string,
  amount: number,
): GameEngineState {
  if (amount < 0) {
    throw new Error('Debit amount cannot be negative');
  }

  const player = findPlayer(state, roomPlayerId);

  if (player.cash < amount) {
    throw new GameEngineError(
      'INSUFFICIENT_FUNDS',
      'Player does not have enough cash',
    );
  }

  return {
    ...state,
    players: state.players.map((candidate) => {
      if (candidate.roomPlayerId !== roomPlayerId) {
        return candidate;
      }

      return {
        ...candidate,
        cash: candidate.cash - amount,
      };
    }),
  };
}

export function creditPlayer(
  state: GameEngineState,
  roomPlayerId: string,
  amount: number,
): GameEngineState {
  if (amount < 0) {
    throw new Error('Credit amount cannot be negative');
  }

  findPlayer(state, roomPlayerId);

  return {
    ...state,
    players: state.players.map((candidate) => {
      if (candidate.roomPlayerId !== roomPlayerId) {
        return candidate;
      }

      return {
        ...candidate,
        cash: candidate.cash + amount,
      };
    }),
  };
}

export function transferPlayerCash(
  state: GameEngineState,
  fromRoomPlayerId: string,
  toRoomPlayerId: string,
  amount: number,
): GameEngineState {
  const debitedState = debitPlayer(state, fromRoomPlayerId, amount);

  return creditPlayer(debitedState, toRoomPlayerId, amount);
}

export function debitPlayerOrCreateDebt(
  state: GameEngineState,
  input: {
    roomPlayerId: string;
    amount: number;
    reason: GameEngineDebtReason;
    creditorRoomPlayerId?: string | null;
  },
): {
  state: GameEngineState;
  events: GameEngineEvent[];
  paid: boolean;
} {
  const player = findPlayer(state, input.roomPlayerId);

  if (input.amount < 0) {
    throw new Error('Debit amount cannot be negative');
  }

  if (player.cash >= input.amount) {
    return {
      state: debitPlayer(state, input.roomPlayerId, input.amount),
      events: [],
      paid: true,
    };
  }

  return {
    state: createDebtState(state, {
      roomPlayerId: input.roomPlayerId,
      creditorRoomPlayerId: input.creditorRoomPlayerId ?? null,
      amount: input.amount,
      reason: input.reason,
    }),
    events: [
      {
        type: 'payment_required',
        roomPlayerId: input.roomPlayerId,
        creditorRoomPlayerId: input.creditorRoomPlayerId ?? null,
        amount: input.amount,
        reason: input.reason,
      },
    ],
    paid: false,
  };
}

export function transferPlayerCashOrCreateDebt(
  state: GameEngineState,
  input: {
    fromRoomPlayerId: string;
    toRoomPlayerId: string;
    amount: number;
    reason: GameEngineDebtReason;
  },
): {
  state: GameEngineState;
  events: GameEngineEvent[];
  paid: boolean;
} {
  const debtor = findPlayer(state, input.fromRoomPlayerId);

  findPlayer(state, input.toRoomPlayerId);

  if (debtor.cash >= input.amount) {
    return {
      state: transferPlayerCash(
        state,
        input.fromRoomPlayerId,
        input.toRoomPlayerId,
        input.amount,
      ),
      events: [],
      paid: true,
    };
  }

  return {
    state: createDebtState(state, {
      roomPlayerId: input.fromRoomPlayerId,
      creditorRoomPlayerId: input.toRoomPlayerId,
      amount: input.amount,
      reason: input.reason,
    }),
    events: [
      {
        type: 'payment_required',
        roomPlayerId: input.fromRoomPlayerId,
        creditorRoomPlayerId: input.toRoomPlayerId,
        amount: input.amount,
        reason: input.reason,
      },
    ],
    paid: false,
  };
}

export function findPlayer(
  state: GameEngineState,
  roomPlayerId: string,
): GameEnginePlayer {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  return player;
}

function createDebtState(
  state: GameEngineState,
  debt: NonNullable<GameEngineState['debt']>,
): GameEngineState {
  return {
    ...state,
    phase: 'awaiting_debt_resolution',
    pendingTileKey: null,
    auction: null,
    debt,
    shouldCurrentPlayerPlayAgain: false,
  };
}

import {
  GameEngineError,
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

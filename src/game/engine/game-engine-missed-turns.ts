import type { GameEngineState } from './game-engine.types';

export function incrementMissedTurn(
  state: GameEngineState,
  roomPlayerId: string | undefined,
  turnNumber: number,
): GameEngineState {
  if (!roomPlayerId) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (
        player.roomPlayerId !== roomPlayerId ||
        player.playerType !== 'human' ||
        player.bankrupt ||
        player.lastMissedTurnNumber === turnNumber
      ) {
        return player;
      }

      return {
        ...player,
        consecutiveMissedTurns: (player.consecutiveMissedTurns ?? 0) + 1,
        lastMissedTurnNumber: turnNumber,
      };
    }),
  };
}

export function resetMissedTurn(
  state: GameEngineState,
  roomPlayerId: string | undefined,
): GameEngineState {
  if (!roomPlayerId) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player) => {
      if (
        player.roomPlayerId !== roomPlayerId ||
        player.playerType !== 'human'
      ) {
        return player;
      }

      return {
        ...player,
        consecutiveMissedTurns: 0,
        lastMissedTurnNumber: null,
      };
    }),
  };
}

export function getConsecutiveMissedTurns(
  state: GameEngineState,
  roomPlayerId: string,
): number {
  return (
    state.players.find((player) => player.roomPlayerId === roomPlayerId)
      ?.consecutiveMissedTurns ?? 0
  );
}

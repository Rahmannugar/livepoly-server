import {
  calculateNetWorthStandings,
  getNetWorthWinners,
} from './game-engine-derived-state';
import {
  GameEngineError,
  type FinishGameByTimeInput,
  type GameEngineResult,
  type GameEngineState,
} from './game-engine.types';

export function finishGameByTime(
  state: GameEngineState,
  input: FinishGameByTimeInput,
): GameEngineResult {
  assertCanFinishByTime(state, input);

  const standings = calculateNetWorthStandings(state);
  const winners = getNetWorthWinners(standings);

  return {
    state: {
      ...state,
      phase: 'finished',
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
      auction: null,
      pendingTileKey: null,
    },
    events: [
      {
        type: 'game_finished_by_time',
        finishedAt: input.finishedAt,
        winnerRoomPlayerId:
          winners.length === 1 ? winners[0].roomPlayerId : null,
        tiedRoomPlayerIds: winners.map((winner) => winner.roomPlayerId),
        standings,
      },
    ],
  };
}

function assertCanFinishByTime(
  state: GameEngineState,
  input: FinishGameByTimeInput,
): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }

  if (!Number.isInteger(input.finishedAt) || input.finishedAt <= 0) {
    throw new GameEngineError(
      'INVALID_FINISH_TIME',
      'Finish time must be a positive timestamp',
    );
  }

  if (state.expiresAt && input.finishedAt < state.expiresAt) {
    throw new GameEngineError(
      'GAME_TIME_NOT_EXPIRED',
      'Game time has not elapsed',
    );
  }
}

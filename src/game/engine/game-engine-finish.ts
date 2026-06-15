import {
  calculateNetWorthStandings,
  getNetWorthWinner,
  getNetWorthWinners,
} from './game-engine-derived-state';
import {
  GameEngineError,
  type FinishGameAfterLastHumanLeftInput,
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
  const winner = getNetWorthWinner(standings);
  const tiedByNetWorth = getNetWorthWinners(standings);

  return {
    state: {
      ...state,
      phase: 'finished',
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
      auction: null,
      pendingTileKey: null,
      tradeOffer: null,
      debt: null,
    },
    events: [
      {
        type: 'game_finished_by_time',
        finishedAt: input.finishedAt,
        winnerRoomPlayerId: winner?.roomPlayerId ?? null,
        tiedRoomPlayerIds: tiedByNetWorth.map((player) => player.roomPlayerId),
        standings,
      },
    ],
  };
}

export function finishGameAfterLastHumanLeft(
  state: GameEngineState,
  input: FinishGameAfterLastHumanLeftInput,
): GameEngineResult {
  assertCanFinishAfterLastHumanLeft(state, input);

  const standings = calculateNetWorthStandings(state);
  const winner = getNetWorthWinner(standings);
  const tiedByNetWorth = getNetWorthWinners(standings);

  return {
    state: {
      ...state,
      phase: 'finished',
      shouldCurrentPlayerPlayAgain: false,
      consecutiveDoublesCount: 0,
      auction: null,
      pendingTileKey: null,
      tradeOffer: null,
      debt: null,
    },
    events: [
      {
        type: 'game_finished_after_last_human_left',
        finishedAt: input.finishedAt,
        winnerRoomPlayerId: winner?.roomPlayerId ?? null,
        tiedRoomPlayerIds: tiedByNetWorth.map((player) => player.roomPlayerId),
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

function assertCanFinishAfterLastHumanLeft(
  state: GameEngineState,
  input: FinishGameAfterLastHumanLeftInput,
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

  // Room membership lives in PostgreSQL, not Redis game state. The room
  // service verifies that no joined humans remain before issuing this command.
}

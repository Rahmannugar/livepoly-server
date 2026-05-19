import type { DiceRoll, GameEngineState } from './game-engine.types';

export function isDoubles(dice: DiceRoll): boolean {
  return dice[0] === dice[1];
}

export function applyDoublesState(
  state: GameEngineState,
  dice: DiceRoll,
): GameEngineState {
  if (!isDoubles(dice)) {
    return {
      ...state,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
    };
  }

  const consecutiveDoublesCount = state.consecutiveDoublesCount + 1;

  return {
    ...state,
    consecutiveDoublesCount,
    shouldCurrentPlayerPlayAgain: consecutiveDoublesCount < 3,
  };
}

export function isThirdConsecutiveDoubles(
  state: GameEngineState,
  dice: DiceRoll,
): boolean {
  return isDoubles(dice) && state.consecutiveDoublesCount + 1 >= 3;
}

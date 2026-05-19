import {
  applyDoublesState,
  isDoubles,
  isThirdConsecutiveDoubles,
} from '../game-engine-dice';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-dice', () => {
  it('detects doubles', () => {
    expect(isDoubles([3, 3])).toBe(true);
    expect(isDoubles([3, 4])).toBe(false);
  });

  it('increments doubles count and grants another turn before third doubles', () => {
    const result = applyDoublesState(createGameEngineState(), [2, 2]);

    expect(result).toMatchObject({
      consecutiveDoublesCount: 1,
      shouldCurrentPlayerPlayAgain: true,
    });
  });

  it('resets doubles count after non-doubles', () => {
    const result = applyDoublesState(
      createGameEngineState({
        consecutiveDoublesCount: 2,
        shouldCurrentPlayerPlayAgain: true,
      }),
      [2, 3],
    );

    expect(result).toMatchObject({
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
    });
  });

  it('detects third consecutive doubles', () => {
    expect(
      isThirdConsecutiveDoubles(
        createGameEngineState({
          consecutiveDoublesCount: 2,
        }),
        [4, 4],
      ),
    ).toBe(true);
  });
});

import {
  assertCanEndTurn,
  assertCanRoll,
  assertCurrentTurn,
  assertValidDice,
} from '../game-engine-assertions';
import { GameEngineError } from '../game-engine.types';
import { createGameEngineState } from './game-engine.test-factory';

describe('game-engine-assertions', () => {
  it('allows rolling while awaiting first turn', () => {
    expect(() => assertCanRoll(createGameEngineState())).not.toThrow();
  });

  it('rejects rolling after a move before ending turn', () => {
    expect(() =>
      assertCanRoll(
        createGameEngineState({
          phase: 'awaiting_turn_end',
        }),
      ),
    ).toThrow(
      new GameEngineError(
        'ROLL_NOT_ALLOWED',
        'Player cannot roll at this point in the turn',
      ),
    );
  });

  it('rejects ending turn before completing a move', () => {
    expect(() => assertCanEndTurn(createGameEngineState())).toThrow(
      new GameEngineError(
        'TURN_END_NOT_ALLOWED',
        'Player cannot end turn before completing an action',
      ),
    );
  });

  it('rejects commands from a non-current player', () => {
    expect(() =>
      assertCurrentTurn(createGameEngineState(), 'room-player-2'),
    ).toThrow(
      new GameEngineError('NOT_CURRENT_TURN', 'It is not this player’s turn'),
    );
  });

  it('rejects invalid dice values', () => {
    expect(() => assertValidDice([0, 7])).toThrow(
      new GameEngineError(
        'INVALID_DICE',
        'Dice roll must contain two values between 1 and 6',
      ),
    );
  });

  it('rejects actions once the game is finished', () => {
    expect(() =>
      assertCanRoll(
        createGameEngineState({
          phase: 'finished',
        }),
      ),
    ).toThrow(new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active'));
  });
});

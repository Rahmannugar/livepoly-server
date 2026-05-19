import {
  GameEngineError,
  type DiceRoll,
  type GameEngineState,
} from './game-engine.types';

export function assertCanRoll(state: GameEngineState): void {
  assertGameActive(state);
  assertNoDebtResolution(state);

  if (
    state.phase !== 'awaiting_first_turn' &&
    state.phase !== 'awaiting_roll'
  ) {
    throw new GameEngineError(
      'ROLL_NOT_ALLOWED',
      'Player cannot roll at this point in the turn',
    );
  }
}

export function assertCanBuyProperty(state: GameEngineState): void {
  assertGameActive(state);
  assertNoDebtResolution(state);

  if (state.phase !== 'awaiting_property_decision') {
    throw new GameEngineError(
      'BUY_NOT_ALLOWED',
      'Player cannot buy property at this point in the turn',
    );
  }
}

export function assertCanEndTurn(state: GameEngineState): void {
  assertGameActive(state);
  assertNoDebtResolution(state);

  if (state.phase !== 'awaiting_turn_end') {
    throw new GameEngineError(
      'TURN_END_NOT_ALLOWED',
      'Player cannot end turn before completing an action',
    );
  }
}

export function assertCurrentTurn(
  state: GameEngineState,
  roomPlayerId: string,
): void {
  const player = state.players.find(
    (candidate) => candidate.roomPlayerId === roomPlayerId,
  );

  if (!player) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is not in game');
  }

  if (player.bankrupt) {
    throw new GameEngineError('PLAYER_NOT_FOUND', 'Player is no longer active');
  }

  if (state.currentTurnRoomPlayerId !== roomPlayerId) {
    throw new GameEngineError(
      'NOT_CURRENT_TURN',
      'It is not this player’s turn',
    );
  }
}

export function assertValidDice(
  dice: readonly number[],
): asserts dice is DiceRoll {
  if (
    dice.length !== 2 ||
    dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
  ) {
    throw new GameEngineError(
      'INVALID_DICE',
      'Dice roll must contain two values between 1 and 6',
    );
  }
}

function assertGameActive(state: GameEngineState): void {
  if (state.phase === 'finished' || state.phase === 'cancelled') {
    throw new GameEngineError('GAME_NOT_ACTIVE', 'Game is not active');
  }
}

function assertNoDebtResolution(state: GameEngineState): void {
  if (state.phase === 'awaiting_debt_resolution' || state.debt) {
    throw new GameEngineError(
      'DEBT_RESOLUTION_REQUIRED',
      'Player must resolve debt before continuing',
    );
  }
}

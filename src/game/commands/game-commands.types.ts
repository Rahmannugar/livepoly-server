import type { DiceRoll, GameEngineState } from '../engine/game-engine.types';

export type RollAndMoveCommand = {
  gameId: string;
  roomPlayerId: string;
  dice: DiceRoll;
};

export type EndTurnCommand = {
  gameId: string;
  roomPlayerId: string;
};

export type GameCommandResult = {
  state: GameEngineState;
};

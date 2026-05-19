import type { GameEngineIntent } from '../engine/game-engine-intents';
import type {
  DiceRoll,
  GameEngineEvent,
  GameEngineState,
} from '../engine/game-engine.types';

export type ExecuteGameIntentCommand = {
  gameId: string;
  roomPlayerId?: string;
  intent: GameEngineIntent;
};

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
  events: GameEngineEvent[];
  intentType: GameEngineIntent['type'];
};

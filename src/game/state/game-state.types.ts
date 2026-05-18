import type { GameEngineState } from '../engine/game-engine.types';

export type GameStateUpdater = (
  state: GameEngineState,
) => GameEngineState | Promise<GameEngineState>;

export type GameStateUpdateOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

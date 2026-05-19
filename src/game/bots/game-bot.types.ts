import type { GameEngineIntent } from '../engine/game-engine-intents';

export type ExecuteBotTurnJob = {
  gameId: string;
};

export type BotDecision = {
  roomPlayerId: string;
  intent: GameEngineIntent;
};

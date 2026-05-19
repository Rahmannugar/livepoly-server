import type { GamePhase } from '../engine/game-engine.types';

export type ExecuteTurnTimeoutJob = {
  gameId: string;
  turnNumber: number;
  phase: GamePhase;
  currentTurnRoomPlayerId: string;
};

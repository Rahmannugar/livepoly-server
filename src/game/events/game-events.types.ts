import type { GameEngineEvent } from '../engine/game-engine.types';

export type GameEventLogRecord = {
  id: string;
  gameId: string;
  sequence: number;
  type: string;
  payload: GameEngineEvent;
  createdAt: Date;
};

export type GameEventCursor = {
  sequence: number;
};

export type GameEventRecoveryItem = {
  sequence: number;
  type: string;
  payload: GameEngineEvent;
  createdAt: string;
};

export type GameEventRecoveryResponse = {
  items: GameEventRecoveryItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

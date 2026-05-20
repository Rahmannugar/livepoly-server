import type { GameEngineState } from '../engine/game-engine.types';

export type GameSnapshotType = 'start' | 'turn' | 'final';

export type CreateGameSnapshotInput = {
  gameId: string;
  roomId: string;
  snapshotType: GameSnapshotType;
  state: GameEngineState;
};

export type GameSnapshotRecord = {
  id: string;
  gameId: string;
  roomId: string;
  snapshotType: GameSnapshotType;
  turnNumber: number;
  state: GameEngineState;
  stateVersion: number;
  createdAt: Date;
};

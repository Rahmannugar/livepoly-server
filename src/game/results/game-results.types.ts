import type {
  GameEngineEvent,
  GameEngineState,
} from '../engine/game-engine.types';

export type GameResultEndReason = 'bankruptcy' | 'time_elapsed' | 'cancelled';

export type FinalizeGameResultInput = {
  gameId: string;
  state: GameEngineState;
  events: GameEngineEvent[];
};

export type SaveGameResultsInput = {
  gameId: string;
  roomId: string;
  state: GameEngineState;
  endReason: GameResultEndReason;
  winnerRoomPlayerId: string | null;
  completedAt: Date;
  durationSeconds: number;
  playerResults: SaveRoomPlayerResultInput[];
};

export type SaveRoomPlayerResultInput = {
  roomId: string;
  roomPlayerId: string;
  userId: string | null;
  seatNumber: number;
  startingCash: number;
  finalCash: number;
  finalNetWorth: number;
  placement: number;
  bankruptAt: Date | null;
};

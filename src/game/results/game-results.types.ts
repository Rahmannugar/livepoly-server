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

export type GameResultPlayerRow = {
  roomPlayerId: string;
  userId: string | null;
  username: string | null;
  playerType: 'human' | 'bot';
  botName: string | null;
  seatNumber: number;
  startingCash: number;
  finalCash: number;
  finalNetWorth: number;
  placement: number;
  bankruptAt: Date | null;
};

export type GameResultResponse = {
  gameId: string;
  roomId: string;
  roomCode: string;
  mode: 'ranked' | 'casual';
  endReason: GameResultEndReason;
  winnerRoomPlayerId: string | null;
  winnerUserId: string | null;
  durationSeconds: number;
  completedAt: Date;
  players: GameResultPlayerRow[];
};

export type UserMatchCursor = {
  completedAt: Date;
  roomResultId: string;
};

export type UserMatchHistoryRow = {
  roomResultId: string;
  gameId: string;
  roomId: string;
  roomCode: string;
  mode: 'ranked' | 'casual';
  placement: number;
  playerCount: number;
  won: boolean;
  endReason: 'bankruptcy' | 'time_elapsed' | 'cancelled';
  finalCash: number;
  finalNetWorth: number;
  bankruptAt: Date | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  durationSeconds: number;
  completedAt: Date;
};

export type UserMatchHistoryItem = {
  gameId: string;
  roomId: string;
  roomCode: string;
  mode: 'ranked' | 'casual';
  placement: number;
  playerCount: number;
  won: boolean;
  endReason: 'bankruptcy' | 'time_elapsed' | 'cancelled';
  finalCash: number;
  finalNetWorth: number;
  bankruptAt: string | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  ratingDelta: number | null;
  durationSeconds: number;
  completedAt: string;
};

export type UserMatchHistoryResponse = {
  items: UserMatchHistoryItem[];
  nextCursor: string | null;
};

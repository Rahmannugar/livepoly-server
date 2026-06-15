export type UserSearchCursor = {
  username: string;
  userId: string;
};

export type UserSearchRow = {
  id: string;
  username: string;
  avatarObjectKey: string | null;
};

export type UserSearchItem = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type UserSearchResponse = {
  items: UserSearchItem[];
  nextCursor: string | null;
};

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
  endReason: 'bankruptcy' | 'time_elapsed' | 'abandoned' | 'cancelled';
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
  endReason: 'bankruptcy' | 'time_elapsed' | 'abandoned' | 'cancelled';
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

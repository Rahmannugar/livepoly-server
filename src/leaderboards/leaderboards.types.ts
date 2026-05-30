export type LeaderboardPeriod = 'weekly' | 'monthly';

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarObjectKey: string | null;
  rating: number;
  gamesPlayed: number;
  wins: number;
  averagePlacement: number;
};

export type LeaderboardResponseEntry = {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  gamesPlayed: number;
  wins: number;
  averagePlacement: number;
};

export type LeaderboardSnapshot = {
  period: LeaderboardPeriod;
  periodStart: Date;
  periodEnd: Date;
  entries: LeaderboardEntry[];
};

export type LeaderboardResponse = {
  period: LeaderboardPeriod;
  periodStart: string;
  periodEnd: string;
  entries: LeaderboardResponseEntry[];
};

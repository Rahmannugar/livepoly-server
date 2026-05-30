export const LEADERBOARD_PERIODS = {
  weekly: 'weekly',
  monthly: 'monthly',
} as const;

export const LEADERBOARD_WINDOWS = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
} as const;

export const LEADERBOARD_CACHE = {
  versionKey: 'leaderboards:version',
  ttlSeconds: {
    weekly: 60,
    monthly: 120,
  },
  ttlJitterRatio: 0.15,
} as const;

export const LEADERBOARD_LIMIT = 100;

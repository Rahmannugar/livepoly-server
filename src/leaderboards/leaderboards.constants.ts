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

export const REFRESH_JOB_ID = 'leaderboards:refresh';
export const REPEAT_REFRESH_JOB_ID = 'leaderboards:refresh:repeat';
export const REFRESH_DEBOUNCE_MS = 10_000;
export const REFRESH_EVERY_MS = 5 * 60 * 1000;

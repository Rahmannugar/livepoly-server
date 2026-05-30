import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const LEADERBOARDS_RATE_LIMIT_RULES = {
  read: [
    {
      scope: 'leaderboards:read:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'leaderboards:read:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

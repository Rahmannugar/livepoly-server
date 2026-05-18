import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const FRIENDS_RATE_LIMIT_RULES = {
  read: [
    {
      scope: 'friends:read:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'friends:read:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],

  mutation: [
    {
      scope: 'friends:mutation:user',
      identifier: { type: 'user' },
      limit: 30,
      windowSeconds: 60,
      burstLimit: 10,
    },
    {
      scope: 'friends:mutation:ip',
      identifier: { type: 'ip' },
      limit: 60,
      windowSeconds: 60,
      burstLimit: 20,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

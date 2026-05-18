import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const NOTIFICATIONS_RATE_LIMIT_RULES = {
  read: [
    {
      scope: 'notifications:read:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'notifications:read:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],

  mutation: [
    {
      scope: 'notifications:mutation:user',
      identifier: { type: 'user' },
      limit: 60,
      windowSeconds: 60,
      burstLimit: 20,
    },
    {
      scope: 'notifications:mutation:ip',
      identifier: { type: 'ip' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

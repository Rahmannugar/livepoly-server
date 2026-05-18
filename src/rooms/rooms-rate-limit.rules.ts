import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const ROOMS_RATE_LIMIT_RULES = {
  read: [
    {
      scope: 'rooms:read:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'rooms:read:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],

  mutation: [
    {
      scope: 'rooms:mutation:user',
      identifier: { type: 'user' },
      limit: 30,
      windowSeconds: 60,
      burstLimit: 10,
    },
    {
      scope: 'rooms:mutation:ip',
      identifier: { type: 'ip' },
      limit: 60,
      windowSeconds: 60,
      burstLimit: 20,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

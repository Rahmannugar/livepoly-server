import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const USERS_RATE_LIMIT_RULES = {
  getMe: [
    {
      scope: 'users:me:get:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'users:me:get:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],

  updateMe: [
    {
      scope: 'users:me:update:user',
      identifier: { type: 'user' },
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    },
    {
      scope: 'users:me:update:ip',
      identifier: { type: 'ip' },
      limit: 30,
      windowSeconds: 10 * 60,
      burstLimit: 10,
    },
  ],

  deleteMe: [
    {
      scope: 'users:me:delete:user',
      identifier: { type: 'user' },
      limit: 3,
      windowSeconds: 60 * 60,
      burstLimit: 1,
    },
    {
      scope: 'users:me:delete:ip',
      identifier: { type: 'ip' },
      limit: 10,
      windowSeconds: 60 * 60,
      burstLimit: 3,
    },
  ],

  getByUsername: [
    {
      scope: 'users:profile:get:ip',
      identifier: { type: 'ip' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
  ],

  getMatches: [
    {
      scope: 'users:matches:get:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'users:matches:get:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],

  search: [
    {
      scope: 'users:search:user',
      identifier: { type: 'user' },
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    },
    {
      scope: 'users:search:ip',
      identifier: { type: 'ip' },
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

import type { RateLimitRule } from '../rate-limit/rate-limit.decorator';

export const AUTH_RATE_LIMIT_RULES = {
  signup: [
    {
      scope: 'auth:signup:ip',
      identifier: { type: 'ip' },
      limit: 5,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    },
    {
      scope: 'auth:signup:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 3,
      windowSeconds: 30 * 60,
      burstLimit: 2,
    },
  ],

  verifyEmail: [
    {
      scope: 'auth:verify-email:ip',
      identifier: { type: 'ip' },
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 5,
    },
    {
      scope: 'auth:verify-email:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    },
  ],

  resendEmailVerification: [
    {
      scope: 'auth:resend-email-verification:ip',
      identifier: { type: 'ip' },
      limit: 3,
      windowSeconds: 10 * 60,
      burstLimit: 2,
    },
    {
      scope: 'auth:resend-email-verification:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 2,
      windowSeconds: 15 * 60,
      burstLimit: 1,
    },
  ],

  login: [
    {
      scope: 'auth:login:ip',
      identifier: { type: 'ip' },
      limit: 20,
      windowSeconds: 10 * 60,
      burstLimit: 8,
    },
    {
      scope: 'auth:login:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    },
    {
      scope: 'auth:login:ip-email',
      identifier: {
        type: 'compound',
        parts: [
          { type: 'ip' },
          { type: 'body', field: 'email', normalize: 'email' },
        ],
      },
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    },
  ],

  forgotPassword: [
    {
      scope: 'auth:forgot-password:ip',
      identifier: { type: 'ip' },
      limit: 5,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    },
    {
      scope: 'auth:forgot-password:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 3,
      windowSeconds: 30 * 60,
      burstLimit: 1,
    },
  ],

  resetPassword: [
    {
      scope: 'auth:reset-password:ip',
      identifier: { type: 'ip' },
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 5,
    },
    {
      scope: 'auth:reset-password:email',
      identifier: { type: 'body', field: 'email', normalize: 'email' },
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    },
  ],
} satisfies Record<string, RateLimitRule[]>;

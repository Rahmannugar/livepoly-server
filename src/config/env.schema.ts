import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3002),
    DATABASE_URL: z.url(),
    NEW_RELIC_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    NEW_RELIC_APP_NAME: z.string().min(1).default('LivePoly Server'),
    NEW_RELIC_LICENSE_KEY: z.string().optional(),
    NEW_RELIC_LOG_LEVEL: z.string().min(1).default('info'),
    JWT_ACCESS_SECRET: z.string().min(32),
    MAIL_FROM: z.string().min(1).default('LivePoly <noreply@livepoly.site>'),
    RESEND_API_KEY: z.string().startsWith('re_'),
    RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    REDIS_URL: z.url(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
    GOOGLE_OAUTH_REDIRECT_URI: z.url(),
    DISCORD_OAUTH_CLIENT_ID: z.string().min(1),
    DISCORD_OAUTH_CLIENT_SECRET: z.string().min(1),
    DISCORD_OAUTH_REDIRECT_URI: z.url(),
    OAUTH_SUCCESS_REDIRECT_URL: z.url(),
    OAUTH_FAILURE_REDIRECT_URL: z.url(),
    R2_PUBLIC_BASE_URL: z.url(),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_AVATAR_MAX_BYTES: z.coerce.number().int().positive().default(10485760),
    R2_BUCKET_NAME: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (env.NEW_RELIC_ENABLED && !env.NEW_RELIC_LICENSE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEW_RELIC_LICENSE_KEY'],
        message:
          'NEW_RELIC_LICENSE_KEY is required when NEW_RELIC_ENABLED=true',
      });
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid environment config: ${parsed.error.message}`);
  }

  return parsed.data;
}

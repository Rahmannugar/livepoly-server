import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3002),
    DATABASE_URL: z.string().url(),
    NEW_RELIC_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    NEW_RELIC_APP_NAME: z.string().min(1).default('LivePoly Server'),
    NEW_RELIC_LICENSE_KEY: z.string().optional(),
    NEW_RELIC_LOG_LEVEL: z.string().min(1).default('info'),
    JWT_ACCESS_SECRET: z.string().min(32),
    MAIL_FROM: z.string().min(1),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive().max(65535),
    SMTP_USER: z.email(),
    SMTP_PASS: z.string().min(1),
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

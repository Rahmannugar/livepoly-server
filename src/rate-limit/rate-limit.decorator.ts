import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_RULES_KEY = 'rate_limit_rules';

type NormalizeMode = 'trim' | 'lowercase' | 'email';

export type RateLimitIdentifier =
  | { type: 'ip' }
  | { type: 'user' }
  | { type: 'body'; field: string; normalize?: NormalizeMode }
  | { type: 'query'; field: string; normalize?: NormalizeMode }
  | { type: 'param'; field: string; normalize?: NormalizeMode }
  | { type: 'cookie'; field: string; normalize?: NormalizeMode }
  | { type: 'compound'; parts: RateLimitIdentifier[] };

export type RateLimitRule = {
  scope: string;
  identifier: RateLimitIdentifier;
  limit: number;
  windowSeconds: number;
  burstLimit: number;
};

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_RULES_KEY, rules);

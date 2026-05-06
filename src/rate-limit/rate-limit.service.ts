import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RateLimitException } from './rate-limit.exception';
import { ObservabilityService } from '../observability/observability.service';

type ConsumeRateLimitInput = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = [
  allowed: number,
  count: number,
  retryAfterSeconds: number,
];

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local count = redis.call("INCR", key)

if count == 1 then
  redis.call("EXPIRE", key, window)
end

local ttl = redis.call("TTL", key)

if count > limit then
  return {0, count, ttl}
end

return {1, count, ttl}
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;

  constructor(
    configService: ConfigService,
    private readonly observabilityService: ObservabilityService,
  ) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async consume(input: ConsumeRateLimitInput): Promise<void> {
    const key = this.buildKey(input.scope, input.identifier);

    const [allowed, count, retryAfterSeconds] = (await this.redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      input.limit,
      input.windowSeconds,
    )) as RateLimitResult;

    if (allowed === 1) {
      return;
    }

    this.logger.warn({
      message: 'Rate limit exceeded',
      scope: input.scope,
      count,
      limit: input.limit,
      retryAfterSeconds,
    });

    this.observabilityService.recordRateLimitExceeded({
      scope: input.scope,
      count,
      limit: input.limit,
      retryAfterSeconds,
    });

    throw new RateLimitException();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private buildKey(scope: string, identifier: string): string {
    return `rl:${scope}:${identifier}`;
  }
}

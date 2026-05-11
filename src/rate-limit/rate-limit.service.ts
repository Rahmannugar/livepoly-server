import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';
import { ObservabilityService } from '../infra/observability/observability.service';
import { RateLimitException } from './rate-limit.exception';

type ConsumeRateLimitInput = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  burstLimit: number;
};

type RateLimitResult = [
  allowed: number,
  count: number,
  retryAfterSeconds: number,
];

const RATE_LIMIT_SCRIPT = `
local slidingKey = KEYS[1]
local bucketTokensKey = KEYS[2]
local bucketTimestampKey = KEYS[3]

local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local capacity = tonumber(ARGV[4])
local refillPerMs = tonumber(ARGV[5])
local cost = tonumber(ARGV[6])
local member = ARGV[7]

redis.call("ZREMRANGEBYSCORE", slidingKey, 0, now - windowMs)
local slidingCount = redis.call("ZCARD", slidingKey)

if slidingCount >= limit then
  local oldest = redis.call("ZRANGE", slidingKey, 0, 0, "WITHSCORES")
  local retryAfterMs = windowMs

  if oldest[2] then
    retryAfterMs = math.max(0, tonumber(oldest[2]) + windowMs - now)
  end

  redis.call("PEXPIRE", slidingKey, windowMs)

  return {0, slidingCount, math.ceil(retryAfterMs / 1000)}
end

local tokens = tonumber(redis.call("GET", bucketTokensKey))
local lastRefill = tonumber(redis.call("GET", bucketTimestampKey))

if tokens == nil then
  tokens = capacity
end

if lastRefill == nil then
  lastRefill = now
end

local elapsedMs = math.max(0, now - lastRefill)
tokens = math.min(capacity, tokens + (elapsedMs * refillPerMs))

local bucketTtlMs = math.max(windowMs, math.ceil((capacity / refillPerMs) * 2))

if tokens < cost then
  local missingTokens = cost - tokens
  local retryAfterMs = math.ceil(missingTokens / refillPerMs)

  redis.call("SET", bucketTokensKey, tokens, "PX", bucketTtlMs)
  redis.call("SET", bucketTimestampKey, now, "PX", bucketTtlMs)
  redis.call("PEXPIRE", slidingKey, windowMs)

  return {0, slidingCount, math.ceil(retryAfterMs / 1000)}
end

tokens = tokens - cost

redis.call("ZADD", slidingKey, now, member)
redis.call("PEXPIRE", slidingKey, windowMs)
redis.call("SET", bucketTokensKey, tokens, "PX", bucketTtlMs)
redis.call("SET", bucketTimestampKey, now, "PX", bucketTtlMs)

return {1, slidingCount + 1, 0}
`;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async consume(input: ConsumeRateLimitInput): Promise<void> {
    if (input.limit <= 0 || input.windowSeconds <= 0) {
      throw new Error('Invalid rate limit configuration');
    }

    const burstLimit = input.burstLimit;

    if (burstLimit <= 0) {
      throw new Error('Invalid rate limit burst configuration');
    }

    const keys = this.buildKeys(input.scope, input.identifier);
    const windowMs = input.windowSeconds * 1000;
    const refillPerMs = input.limit / windowMs;

    const [allowed, count, retryAfterSeconds] = (await this.cacheService.eval(
      RATE_LIMIT_SCRIPT,
      [keys.slidingWindow, keys.bucketTokens, keys.bucketTimestamp],
      [
        Date.now(),
        windowMs,
        input.limit,
        burstLimit,
        refillPerMs,
        1,
        randomUUID(),
      ],
    )) as RateLimitResult;

    if (allowed === 1) {
      return;
    }

    this.logger.warn({
      message: 'Rate limit exceeded',
      scope: input.scope,
      count,
      limit: input.limit,
      burstLimit,
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

  private buildKeys(
    scope: string,
    identifier: string,
  ): {
    slidingWindow: string;
    bucketTokens: string;
    bucketTimestamp: string;
  } {
    const baseKey = `${scope}:${identifier}`;

    return {
      slidingWindow: `rl:sw:${baseKey}`,
      bucketTokens: `rl:tb:tokens:${baseKey}`,
      bucketTimestamp: `rl:tb:ts:${baseKey}`,
    };
  }
}

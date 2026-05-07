import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { ObservabilityService } from '../observability/observability.service';
import { RateLimitException } from './rate-limit.exception';

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
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async consume(input: ConsumeRateLimitInput): Promise<void> {
    const key = this.buildKey(input.scope, input.identifier);

    const [allowed, count, retryAfterSeconds] = (await this.cacheService.eval(
      RATE_LIMIT_SCRIPT,
      [key],
      [input.limit, input.windowSeconds],
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

  private buildKey(scope: string, identifier: string): string {
    return `rl:${scope}:${identifier}`;
  }
}

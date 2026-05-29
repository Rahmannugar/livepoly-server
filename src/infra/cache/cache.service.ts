import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheSetOptions, GetOrSetInput, WithLockInput } from './cache.types';
import { withTtlJitter } from '../../common/utils/jitter';

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end

return 0
`;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    options: CacheSetOptions = {},
  ): Promise<void> {
    const ttl = options.ttlJitterRatio
      ? withTtlJitter(ttlSeconds, options.ttlJitterRatio)
      : ttlSeconds;

    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async eval(script: string, keys: string[], args: Array<string | number>) {
    return this.redis.eval(script, keys.length, ...keys, ...args);
  }

  async getOrSet<T>(input: GetOrSetInput<T>): Promise<T> {
    const cached = await this.get<T>(input.key);

    if (cached !== null) {
      return cached;
    }

    const existing = this.inFlight.get(input.key);

    if (existing) {
      return existing as Promise<T>;
    }

    const promise = this.loadWithDistributedLock(input).finally(() => {
      this.inFlight.delete(input.key);
    });

    this.inFlight.set(input.key, promise);

    return promise;
  }

  async withLock<T>(input: WithLockInput<T>): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + (input.waitTimeoutMs ?? 5000);
    const retryDelayMs = input.retryDelayMs ?? 100;

    while (Date.now() < deadline) {
      const acquired = await this.redis.set(
        input.key,
        token,
        'EX',
        input.ttlSeconds,
        'NX',
      );

      if (acquired === 'OK') {
        try {
          return await input.callback();
        } finally {
          await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, input.key, token);
        }
      }

      await this.sleep(retryDelayMs);
    }

    throw new Error('Could not acquire cache lock');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async loadWithDistributedLock<T>(
    input: GetOrSetInput<T>,
  ): Promise<T> {
    return this.withLock({
      key: `lock:${input.key}`,
      ttlSeconds: input.lockSeconds ?? 10,
      callback: async () => {
        const cached = await this.get<T>(input.key);

        if (cached !== null) {
          return cached;
        }

        const value = await input.factory();
        await this.set(input.key, value, input.ttlSeconds, {
          ttlJitterRatio: input.ttlJitterRatio,
        });

        return value;
      },
    });
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

import { randomUUID } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type GetOrSetInput<T> = {
  key: string;
  ttlSeconds: number;
  factory: () => Promise<T>;
  lockSeconds?: number;
};

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

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.set(key, serialized, 'EX', ttlSeconds);
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

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async loadWithDistributedLock<T>(
    input: GetOrSetInput<T>,
  ): Promise<T> {
    const lockKey = `lock:${input.key}`;
    const lockToken = randomUUID();
    const lockMs = (input.lockSeconds ?? 10) * 1000;

    const acquired = await this.redis.set(
      lockKey,
      lockToken,
      'PX',
      lockMs,
      'NX',
    );

    if (acquired !== 'OK') {
      await this.sleep(100);

      const cached = await this.get<T>(input.key);

      if (cached !== null) {
        return cached;
      }

      return this.loadWithDistributedLock(input);
    }

    try {
      const cached = await this.get<T>(input.key);

      if (cached !== null) {
        return cached;
      }

      const value = await input.factory();
      await this.set(input.key, value, input.ttlSeconds);

      return value;
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken);
    }
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}

export type GetOrSetInput<T> = {
  key: string;
  ttlSeconds: number;
  factory: () => Promise<T>;
  lockSeconds?: number;
  ttlJitterRatio?: number;
};

export type CacheSetOptions = {
  ttlJitterRatio?: number;
};

export type WithLockInput<T> = {
  key: string;
  ttlSeconds: number;
  callback: () => Promise<T>;
  waitTimeoutMs?: number;
  retryDelayMs?: number;
};

export type WithLockOrSkipInput<T> = {
  key: string;
  ttlSeconds: number;
  callback: () => Promise<T>;
};

export type LockOrSkipResult<T> =
  | {
      acquired: true;
      value: T;
    }
  | {
      acquired: false;
      value: null;
    };

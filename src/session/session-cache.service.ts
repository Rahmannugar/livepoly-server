import { Injectable } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';

type CachedSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
};

type StoreSessionInput = {
  session: CachedSession;
  ttlSeconds: number;
};

@Injectable()
export class SessionCacheService {
  constructor(private readonly cacheService: CacheService) {}

  async storeSession(input: StoreSessionInput) {
    await this.cacheService.set(
      this.sessionKey(input.session.refreshTokenHash),
      input.session,
      input.ttlSeconds,
    );
  }

  async getSession(refreshTokenHash: string) {
    return this.cacheService.get<CachedSession>(
      this.sessionKey(refreshTokenHash),
    );
  }

  async deleteSession(refreshTokenHash: string) {
    await this.cacheService.del(this.sessionKey(refreshTokenHash));
  }

  async withUserSessionLock<T>(userId: string, callback: () => Promise<T>) {
    return this.cacheService.withLock({
      key: `lock:session:user:${userId}`,
      ttlSeconds: 10,
      callback,
    });
  }

  private sessionKey(refreshTokenHash: string): string {
    return `session:refresh:${refreshTokenHash}`;
  }
}

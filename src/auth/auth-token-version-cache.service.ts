import { Injectable } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';

const TOKEN_VERSION_CACHE_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AuthTokenVersionCacheService {
  constructor(private readonly cacheService: CacheService) {}

  async set(userId: string, tokenVersion: number) {
    await this.cacheService.set(
      this.key(userId),
      tokenVersion,
      TOKEN_VERSION_CACHE_TTL_SECONDS,
    );
  }

  async get(userId: string) {
    return this.cacheService.get<number>(this.key(userId));
  }

  async delete(userId: string) {
    await this.cacheService.del(this.key(userId));
  }

  private key(userId: string) {
    return `auth:user-token-version:${userId}`;
  }
}

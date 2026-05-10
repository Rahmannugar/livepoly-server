import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

@Injectable()
export class OAuthStateService {
  constructor(private readonly cacheService: CacheService) {}

  async createState(provider: 'google' | 'discord') {
    const state = randomBytes(32).toString('base64url');

    await this.cacheService.set(
      this.stateKey(provider, state),
      true,
      OAUTH_STATE_TTL_SECONDS,
    );

    return state;
  }

  async consumeState(provider: 'google' | 'discord', state: string) {
    const key = this.stateKey(provider, state);
    const exists = await this.cacheService.get<boolean>(key);

    if (!exists) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    await this.cacheService.del(key);
  }

  private stateKey(provider: 'google' | 'discord', state: string) {
    return `oauth:state:${provider}:${state}`;
  }
}

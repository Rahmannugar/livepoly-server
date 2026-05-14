import { Injectable } from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { AuthUser } from '../auth/types/auth-user.type';

export type UsersRequestContext = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class UsersRateLimitService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async enforceGetMe(authUser: AuthUser, context: UsersRequestContext) {
    await this.rateLimitService.consume({
      scope: 'users:me:get:user',
      identifier: authUser.id,
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });

    await this.rateLimitService.consume({
      scope: 'users:me:get:ip',
      identifier: this.resolveIp(context),
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    });
  }

  async enforceUpdateMe(authUser: AuthUser, context: UsersRequestContext) {
    await this.rateLimitService.consume({
      scope: 'users:me:update:user',
      identifier: authUser.id,
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    });

    await this.rateLimitService.consume({
      scope: 'users:me:update:ip',
      identifier: this.resolveIp(context),
      limit: 30,
      windowSeconds: 10 * 60,
      burstLimit: 10,
    });
  }

  async enforceDeleteMe(authUser: AuthUser, context: UsersRequestContext) {
    await this.rateLimitService.consume({
      scope: 'users:me:delete:user',
      identifier: authUser.id,
      limit: 3,
      windowSeconds: 60 * 60,
      burstLimit: 1,
    });

    await this.rateLimitService.consume({
      scope: 'users:me:delete:ip',
      identifier: this.resolveIp(context),
      limit: 10,
      windowSeconds: 60 * 60,
      burstLimit: 3,
    });
  }

  async enforceGetPublicProfile(context: UsersRequestContext) {
    await this.rateLimitService.consume({
      scope: 'users:public-profile:get:ip',
      identifier: this.resolveIp(context),
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });
  }

  private resolveIp(context: UsersRequestContext): string {
    return context.ip || 'unknown';
  }
}

import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimitService } from '../rate-limit/rate-limit.service';

export type FriendsRequestContext = {
  ip?: string;
  userAgent?: string | string[];
};

@Injectable()
export class FriendsRateLimitService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async enforceFriendMutation(
    authUser: AuthUser,
    context: FriendsRequestContext,
  ) {
    await this.rateLimitService.consume({
      scope: 'friends:mutation:user',
      identifier: authUser.id,
      limit: 30,
      windowSeconds: 60,
      burstLimit: 10,
    });

    await this.rateLimitService.consume({
      scope: 'friends:mutation:ip',
      identifier: this.resolveIp(context),
      limit: 60,
      windowSeconds: 60,
      burstLimit: 20,
    });
  }

  async enforceFriendRead(authUser: AuthUser, context: FriendsRequestContext) {
    await this.rateLimitService.consume({
      scope: 'friends:read:user',
      identifier: authUser.id,
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });

    await this.rateLimitService.consume({
      scope: 'friends:read:ip',
      identifier: this.resolveIp(context),
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    });
  }

  private resolveIp(context: FriendsRequestContext): string {
    return context.ip || 'unknown';
  }
}

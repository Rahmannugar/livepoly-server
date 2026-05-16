import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { RateLimitService } from '../rate-limit/rate-limit.service';

export type NotificationsRequestContext = {
  ip?: string;
  userAgent?: string | string[];
};

@Injectable()
export class NotificationsRateLimitService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async enforceRead(authUser: AuthUser, context: NotificationsRequestContext) {
    await this.rateLimitService.consume({
      scope: 'notifications:read:user',
      identifier: authUser.id,
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });

    await this.rateLimitService.consume({
      scope: 'notifications:read:ip',
      identifier: this.resolveIp(context),
      limit: 240,
      windowSeconds: 60,
      burstLimit: 80,
    });
  }

  async enforceMutation(
    authUser: AuthUser,
    context: NotificationsRequestContext,
  ) {
    await this.rateLimitService.consume({
      scope: 'notifications:mutation:user',
      identifier: authUser.id,
      limit: 60,
      windowSeconds: 60,
      burstLimit: 20,
    });

    await this.rateLimitService.consume({
      scope: 'notifications:mutation:ip',
      identifier: this.resolveIp(context),
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });
  }

  private resolveIp(context: NotificationsRequestContext): string {
    return context.ip || 'unknown';
  }
}

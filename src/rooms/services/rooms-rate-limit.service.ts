import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

export type RoomsRequestContext = {
  ip?: string;
  userAgent?: string | string[];
};

@Injectable()
export class RoomsRateLimitService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async enforceRoomRead(authUser: AuthUser, context: RoomsRequestContext) {
    await this.rateLimitService.consume({
      scope: 'rooms:read:user',
      identifier: authUser.id,
      limit: 120,
      windowSeconds: 60,
      burstLimit: 40,
    });

    await this.rateLimitService.consume({
      scope: 'rooms:read:ip',
      identifier: this.resolveIp(context),
      limit: 300,
      windowSeconds: 60,
      burstLimit: 80,
    });
  }

  async enforceRoomMutation(authUser: AuthUser, context: RoomsRequestContext) {
    await this.rateLimitService.consume({
      scope: 'rooms:mutation:user',
      identifier: authUser.id,
      limit: 30,
      windowSeconds: 60,
      burstLimit: 8,
    });

    await this.rateLimitService.consume({
      scope: 'rooms:mutation:ip',
      identifier: this.resolveIp(context),
      limit: 80,
      windowSeconds: 60,
      burstLimit: 20,
    });
  }

  private resolveIp(context: RoomsRequestContext): string {
    return context.ip || 'unknown';
  }
}

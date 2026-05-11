import { Injectable } from '@nestjs/common';
import { RateLimitService } from '../rate-limit/rate-limit.service';

export type AuthRequestContext = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async enforceRegister(context: AuthRequestContext, email: string) {
    await this.rateLimitService.consume({
      scope: 'auth:register:ip',
      identifier: this.resolveIp(context),
      limit: 5,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    });

    await this.rateLimitService.consume({
      scope: 'auth:register:email',
      identifier: email,
      limit: 3,
      windowSeconds: 30 * 60,
      burstLimit: 2,
    });
  }

  async enforceVerifyEmail(context: AuthRequestContext, email: string) {
    await this.rateLimitService.consume({
      scope: 'auth:verify-email:ip',
      identifier: this.resolveIp(context),
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 5,
    });

    await this.rateLimitService.consume({
      scope: 'auth:verify-email:email',
      identifier: email,
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    });
  }

  async enforceResendEmailVerification(
    context: AuthRequestContext,
    email: string,
  ) {
    await this.rateLimitService.consume({
      scope: 'auth:resend-email-verification:ip',
      identifier: this.resolveIp(context),
      limit: 3,
      windowSeconds: 10 * 60,
      burstLimit: 2,
    });

    await this.rateLimitService.consume({
      scope: 'auth:resend-email-verification:email',
      identifier: email,
      limit: 2,
      windowSeconds: 15 * 60,
      burstLimit: 1,
    });
  }

  async enforceLogin(context: AuthRequestContext, email: string) {
    const ip = this.resolveIp(context);

    await this.rateLimitService.consume({
      scope: 'auth:login:ip',
      identifier: ip,
      limit: 20,
      windowSeconds: 10 * 60,
      burstLimit: 8,
    });

    await this.rateLimitService.consume({
      scope: 'auth:login:email',
      identifier: email,
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    });

    await this.rateLimitService.consume({
      scope: 'auth:login:ip-email',
      identifier: `${ip}:${email}`,
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    });
  }

  async enforceForgotPassword(context: AuthRequestContext, email: string) {
    await this.rateLimitService.consume({
      scope: 'auth:forgot-password:ip',
      identifier: this.resolveIp(context),
      limit: 5,
      windowSeconds: 10 * 60,
      burstLimit: 3,
    });

    await this.rateLimitService.consume({
      scope: 'auth:forgot-password:email',
      identifier: email,
      limit: 3,
      windowSeconds: 30 * 60,
      burstLimit: 1,
    });
  }

  async enforceResetPassword(context: AuthRequestContext, email: string) {
    await this.rateLimitService.consume({
      scope: 'auth:reset-password:ip',
      identifier: this.resolveIp(context),
      limit: 10,
      windowSeconds: 10 * 60,
      burstLimit: 5,
    });

    await this.rateLimitService.consume({
      scope: 'auth:reset-password:email',
      identifier: email,
      limit: 5,
      windowSeconds: 15 * 60,
      burstLimit: 3,
    });
  }

  private resolveIp(context: AuthRequestContext): string {
    return context.ip || 'unknown';
  }
}

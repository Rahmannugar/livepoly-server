import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { hashToken } from '../auth/utils/utils';

type StoreOtpInput = {
  userId: string;
  otpCode: string;
  ttlSeconds: number;
};

@Injectable()
export class OtpService {
  constructor(private readonly cacheService: CacheService) {}

  async storeEmailVerificationOtp(input: StoreOtpInput) {
    await this.cacheService.set(
      this.emailVerificationKey(input.userId),
      hashToken(input.otpCode),
      input.ttlSeconds,
    );
  }

  async isValidEmailVerificationOtp(userId: string, otpCode: string) {
    const storedHash = await this.cacheService.get<string>(
      this.emailVerificationKey(userId),
    );

    return Boolean(storedHash && storedHash === hashToken(otpCode));
  }

  async deleteEmailVerificationOtp(userId: string) {
    await this.cacheService.del(this.emailVerificationKey(userId));
  }

  async storePasswordResetOtp(input: StoreOtpInput) {
    await this.cacheService.set(
      this.passwordResetKey(input.userId),
      hashToken(input.otpCode),
      input.ttlSeconds,
    );
  }

  async isValidPasswordResetOtp(userId: string, otpCode: string) {
    const storedHash = await this.cacheService.get<string>(
      this.passwordResetKey(userId),
    );

    return Boolean(storedHash && storedHash === hashToken(otpCode));
  }

  async deletePasswordResetOtp(userId: string) {
    await this.cacheService.del(this.passwordResetKey(userId));
  }

  private passwordResetKey(userId: string): string {
    return `otp:password-reset:${userId}`;
  }

  private emailVerificationKey(userId: string): string {
    return `otp:email-verification:${userId}`;
  }
}

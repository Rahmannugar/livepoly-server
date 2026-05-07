import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailQueueService } from '../mail/mail-queue.service';
import { OtpService } from '../otp/otp.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AUTH } from './auth.constants';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { generateOtpCode, hashPassword } from './utils/utils';

type AuthRequestContext = {
  ip?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly mailQueueService: MailQueueService,
    private readonly rateLimitService: RateLimitService,
    private readonly otpService: OtpService,
  ) {}

  private async enforceRegisterRateLimit(
    context: AuthRequestContext,
    email: string,
  ) {
    await this.rateLimitService.consume({
      scope: 'auth:register:ip',
      identifier: this.resolveIp(context),
      limit: 5,
      windowSeconds: 10 * 60,
    });

    await this.rateLimitService.consume({
      scope: 'auth:register:email',
      identifier: email,
      limit: 3,
      windowSeconds: 30 * 60,
    });
  }

  private async enforceVerifyEmailRateLimit(
    context: AuthRequestContext,
    email: string,
  ) {
    await this.rateLimitService.consume({
      scope: 'auth:verify-email:ip',
      identifier: this.resolveIp(context),
      limit: 10,
      windowSeconds: 10 * 60,
    });

    await this.rateLimitService.consume({
      scope: 'auth:verify-email:email',
      identifier: email,
      limit: 5,
      windowSeconds: 15 * 60,
    });
  }

  private resolveIp(context: AuthRequestContext): string {
    return context.ip || 'unknown';
  }

  async register(dto: RegisterDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    await this.enforceRegisterRateLimit(context, email);

    const existingUser = await this.authRepository.findUserByEmailOrUsername(
      email,
      username,
    );

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const otpCode = generateOtpCode();

    const user = await this.authRepository.createUser({
      email,
      username,
      passwordHash,
    });

    await this.otpService.storeEmailVerificationOtp({
      userId: user.id,
      otpCode,
      ttlSeconds: AUTH.emailOtpTtlMinutes * 60,
    });

    await this.mailQueueService.enqueueEmailVerificationOtp({
      email: user.email,
      otpCode,
    });

    return {
      message: 'Verification code sent',
    };
  }

  async verifyEmail(dto: VerifyEmailDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();

    await this.enforceVerifyEmailRateLimit(context, email);

    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'Email already verified',
      };
    }

    const verified = await this.otpService.isValidEmailVerificationOtp(
      user.id,
      dto.otpCode,
    );

    if (!verified) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.authRepository.markEmailVerified(user.id);
    await this.otpService.deleteEmailVerificationOtp(user.id);

    return {
      message: 'Email verified',
    };
  }
}

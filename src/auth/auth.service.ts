import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailQueueService } from '../mail/mail-queue.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AUTH } from './auth.constants';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { generateOtpCode, hashPassword, hashToken } from './utils/utils';

type AuthRequestContext = {
  ip?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly mailQueueService: MailQueueService,
    private readonly rateLimitService: RateLimitService,
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
    const otpHash = hashToken(otpCode);
    const otpExpiresAt = new Date(
      Date.now() + AUTH.emailOtpTtlMinutes * 60 * 1000,
    );

    const user = await this.authRepository.createUserWithEmailOtp({
      email,
      username,
      passwordHash,
      otpHash,
      otpExpiresAt,
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
    const otpHash = hashToken(dto.otpCode);

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

    const verified = await this.authRepository.verifyEmailOtp({
      userId: user.id,
      otpHash,
    });

    if (!verified) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    return {
      message: 'Email verified',
    };
  }
}

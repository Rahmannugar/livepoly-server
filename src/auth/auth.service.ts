import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { MailQueueService } from '../mail/mail-queue.service';
import { OtpService } from '../otp/otp.service';
import { SessionCacheService } from '../session/session-cache.service';
import {
  AuthRateLimitService,
  AuthRequestContext,
} from './auth-rate-limit.service';
import { AUTH } from './auth.constants';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  ResendEmailVerificationDto,
  VerifyEmailDto,
} from './dto/verify-email.dto';
import {
  generateOpaqueToken,
  generateOtpCode,
  hashPassword,
  hashToken,
  verifyPassword,
} from './utils/utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly mailQueueService: MailQueueService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionCacheService: SessionCacheService,
    private readonly databaseService: DatabaseService,
    private readonly authRateLimitService: AuthRateLimitService,
  ) {}

  async register(dto: RegisterDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    await this.authRateLimitService.enforceRegister(context, email);

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

    await this.authRateLimitService.enforceVerifyEmail(context, email);

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

  async resendEmailVerification(
    dto: ResendEmailVerificationDto,
    context: AuthRequestContext,
  ) {
    const email = dto.email.trim().toLowerCase();

    await this.authRateLimitService.enforceResendEmailVerification(
      context,
      email,
    );

    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return {
        message: 'Email already verified',
      };
    }

    const otpCode = generateOtpCode();

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

  async login(dto: LoginDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();

    await this.authRateLimitService.enforceLogin(context, email);

    const user = await this.authRepository.findUserByEmail(email);

    if (!user?.passwordHash) {
      throw new BadRequestException('Invalid email or password');
    }

    const passwordValid = await verifyPassword(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new BadRequestException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new BadRequestException('Email verification required');
    }

    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + AUTH.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const { session, revokedSession } =
      await this.sessionCacheService.withUserSessionLock(user.id, () =>
        this.databaseService.transaction(async (tx) => {
          const activeSessions = await this.authRepository.countActiveSessions(
            user.id,
            tx,
          );

          let revokedSession:
            | { id: string; refreshTokenHash: string }
            | undefined;

          if (activeSessions >= AUTH.maxActiveSessions) {
            revokedSession =
              await this.authRepository.revokeOldestActiveSession(user.id, tx);
          }

          const session = await this.authRepository.createSession(
            {
              userId: user.id,
              refreshTokenHash,
              expiresAt: refreshExpiresAt,
              ipAddress: context.ip,
              userAgent: context.userAgent,
            },
            tx,
          );

          return { session, revokedSession };
        }),
      );

    if (revokedSession) {
      await this.sessionCacheService.deleteSession(
        revokedSession.refreshTokenHash,
      );
    }

    const refreshTtlSeconds = AUTH.refreshTokenTtlDays * 24 * 60 * 60;

    await this.sessionCacheService.storeSession({
      session: {
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        expiresAt: session.expiresAt.toISOString(),
      },
      ttlSeconds: refreshTtlSeconds,
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: session.id,
        tv: user.tokenVersion,
        email: user.email,
        username: user.username,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: AUTH.accessTokenTtl,
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const currentRefreshTokenHash = hashToken(refreshToken);

    const cachedSession = await this.sessionCacheService.getSession(
      currentRefreshTokenHash,
    );

    const session =
      cachedSession ??
      (await this.authRepository.findActiveSessionByRefreshTokenHash(
        currentRefreshTokenHash,
      ));

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.authRepository.findUserByIdForAuthToken(
      session.userId,
    );

    if (!user?.emailVerified) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextRefreshTokenHash = hashToken(nextRefreshToken);
    const nextRefreshExpiresAt = new Date(
      Date.now() + AUTH.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    const rotatedSession = await this.sessionCacheService.withUserSessionLock(
      user.id,
      () =>
        this.databaseService.transaction((tx) =>
          this.authRepository.rotateSessionRefreshToken(
            {
              sessionId: session.id,
              currentRefreshTokenHash,
              nextRefreshTokenHash,
              expiresAt: nextRefreshExpiresAt,
            },
            tx,
          ),
        ),
    );

    if (!rotatedSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.sessionCacheService.deleteSession(currentRefreshTokenHash);

    await this.sessionCacheService.storeSession({
      session: {
        id: rotatedSession.id,
        userId: rotatedSession.userId,
        refreshTokenHash: rotatedSession.refreshTokenHash,
        expiresAt: rotatedSession.expiresAt.toISOString(),
      },
      ttlSeconds: AUTH.refreshTokenTtlDays * 24 * 60 * 60,
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: rotatedSession.id,
        tv: user.tokenVersion,
        email: user.email,
        username: user.username,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: AUTH.accessTokenTtl,
      },
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }
}

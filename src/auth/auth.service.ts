import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../infra/database/database.service';
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
import { SignupDto } from './dto/signup.dto';
import {
  ResendEmailVerificationDto,
  VerifyEmailDto,
} from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

import {
  generateOpaqueToken,
  generateOtpCode,
  hashPassword,
  hashToken,
  verifyPassword,
} from './utils/utils';
import { AuthTokenVersionCacheService } from './auth-token-version-cache.service';
import { randomInt } from 'crypto';
import { OAuthClientService } from './oauth-client.service';
import { OAuthProfile } from './auth.types';
import { OAuthStateService } from './oauth-state.service';
import { ObservabilityService } from '../infra/observability/observability.service';

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
    private readonly oauthClientService: OAuthClientService,
    private readonly oauthStateService: OAuthStateService,
    private readonly authTokenVersionCacheService: AuthTokenVersionCacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  //helpers
  private async createSessionForUser(
    user: {
      id: string;
      email: string;
      username: string;
      tokenVersion: number;
    },
    context: AuthRequestContext,
  ) {
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

    await Promise.all([
      this.sessionCacheService.storeSession({
        session: {
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt.toISOString(),
        },
        ttlSeconds: AUTH.refreshTokenTtlDays * 24 * 60 * 60,
      }),
      this.authTokenVersionCacheService.set(user.id, user.tokenVersion),
    ]);

    return {
      refreshToken,
      sessionId: session.id,
      user,
    };
  }

  private async loginOrCreateOAuthUser(
    profile: OAuthProfile,
    context: AuthRequestContext,
  ) {
    if (!profile.emailVerified) {
      this.recordSecurityEvent('OAuthFailed', {
        provider: profile.provider,
        reason: 'email_unverified',
        hasIp: Boolean(context.ip),
      });

      throw new UnauthorizedException('OAuth email must be verified');
    }

    const oauthUser = await this.authRepository.findUserByOAuthAccount(
      profile.provider,
      profile.providerAccountId,
    );

    if (oauthUser) {
      await this.authRepository.updateOAuthAccountEmail({
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        providerEmail: profile.email,
      });

      return this.createSessionForUser(oauthUser, context);
    }

    const user = await this.databaseService.transaction(async (tx) => {
      const emailUser = await this.authRepository.findUserByEmail(
        profile.email,
      );

      if (emailUser) {
        await this.authRepository.linkOAuthAccount(
          {
            userId: emailUser.id,
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            providerEmail: profile.email,
          },
          tx,
        );

        if (!emailUser.emailVerified) {
          await this.authRepository.markEmailVerified(emailUser.id, tx);
        }

        return {
          id: emailUser.id,
          email: emailUser.email,
          username: emailUser.username,
          tokenVersion: emailUser.tokenVersion,
        };
      }

      const username = await this.generateAvailableUsername(
        profile.usernameSeed,
      );

      return this.authRepository.createOAuthUser(
        {
          email: profile.email,
          username,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          providerEmail: profile.email,
        },
        tx,
      );
    });

    return this.createSessionForUser(user, context);
  }

  private async generateAvailableUsername(seed: string) {
    const base = seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);

    const fallbackBase = base || 'player';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = attempt === 0 ? '' : `${randomInt(1000, 9999)}`;
      const username = `${fallbackBase}${suffix}`;

      const existing = await this.authRepository.findUserByUsername(username);

      if (!existing) {
        return username;
      }
    }

    return `player${randomInt(100000, 999999)}`;
  }

  private recordSecurityEvent(
    eventName: string,
    attributes: Record<
      string,
      string | number | boolean | null | undefined
    > = {},
  ) {
    this.observabilityService.recordSecurityEvent(eventName, attributes);
  }

  //public methods
  async signup(dto: SignupDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    this.recordSecurityEvent('SignupRequested', {
      hasIp: Boolean(context.ip),
    });

    await this.authRateLimitService.enforceSignup(context, email);

    const existingUser = await this.authRepository.findUserByEmailOrUsername(
      email,
      username,
    );

    if (existingUser) {
      this.recordSecurityEvent('SignupFailed', {
        reason: 'email_or_username_exists',
        hasIp: Boolean(context.ip),
      });

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

    this.recordSecurityEvent('SignupSucceeded', {
      userId: user.id,
      hasIp: Boolean(context.ip),
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
      this.recordSecurityEvent('EmailVerificationFailed', {
        reason: 'user_not_found',
        hasIp: Boolean(context.ip),
      });

      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      this.recordSecurityEvent('EmailVerificationSucceeded', {
        userId: user.id,
        alreadyVerified: true,
        hasIp: Boolean(context.ip),
      });

      return {
        message: 'Email already verified',
      };
    }

    const verified = await this.otpService.isValidEmailVerificationOtp(
      user.id,
      dto.otpCode,
    );

    if (!verified) {
      this.recordSecurityEvent('EmailVerificationFailed', {
        reason: 'invalid_otp',
        userId: user.id,
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.authRepository.markEmailVerified(user.id);
    await this.otpService.deleteEmailVerificationOtp(user.id);

    this.recordSecurityEvent('EmailVerificationSucceeded', {
      userId: user.id,
      alreadyVerified: false,
      hasIp: Boolean(context.ip),
    });

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

    const genericResponse = {
      message:
        'If the email belongs to a Livepoly account that requires verification, a code will be sent',
    };

    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      this.recordSecurityEvent('EmailVerificationResendSkipped', {
        reason: 'user_not_found',
        hasIp: Boolean(context.ip),
      });

      return genericResponse;
    }

    if (user.emailVerified) {
      this.recordSecurityEvent('EmailVerificationResendSkipped', {
        reason: 'already_verified',
        userId: user.id,
        hasIp: Boolean(context.ip),
      });

      return genericResponse;
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

    this.recordSecurityEvent('EmailVerificationResent', {
      userId: user.id,
      hasIp: Boolean(context.ip),
    });

    return genericResponse;
  }

  async login(dto: LoginDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();

    await this.authRateLimitService.enforceLogin(context, email);

    const user = await this.authRepository.findUserByEmail(email);

    if (!user?.passwordHash) {
      this.recordSecurityEvent('LoginFailed', {
        reason: 'invalid_credentials',
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid email or password');
    }

    const passwordValid = await verifyPassword(user.passwordHash, dto.password);

    if (!passwordValid) {
      this.recordSecurityEvent('LoginFailed', {
        reason: 'invalid_credentials',
        userId: user.id,
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid email or password');
    }

    if (!user.emailVerified) {
      this.recordSecurityEvent('LoginFailed', {
        reason: 'email_unverified',
        userId: user.id,
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Email verification required');
    }

    const result = await this.createSessionForUser(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        tokenVersion: user.tokenVersion,
      },
      context,
    );

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sid: result.sessionId,
        tv: user.tokenVersion,
        email: user.email,
        username: user.username,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: AUTH.accessTokenTtl,
      },
    );

    this.recordSecurityEvent('LoginSucceeded', {
      userId: user.id,
      hasIp: Boolean(context.ip),
    });

    return {
      accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      this.recordSecurityEvent('RefreshFailed', {
        reason: 'missing_refresh_token',
      });

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
      this.recordSecurityEvent('RefreshFailed', {
        reason: 'invalid_session',
      });

      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.authRepository.findUserByIdForAuthToken(
      session.userId,
    );

    if (!user?.emailVerified) {
      this.recordSecurityEvent('RefreshFailed', {
        reason: 'invalid_user',
        userId: session.userId,
      });

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
      this.recordSecurityEvent('RefreshFailed', {
        reason: 'rotation_failed',
        userId: user.id,
      });

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

    await this.authTokenVersionCacheService.set(user.id, user.tokenVersion);

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

    this.recordSecurityEvent('RefreshSucceeded', {
      userId: user.id,
    });

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

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      this.recordSecurityEvent('LogoutSucceeded', {
        hasRefreshToken: false,
      });

      return {
        message: 'User logged out',
      };
    }

    const refreshTokenHash = hashToken(refreshToken);

    await this.authRepository.revokeSession(refreshTokenHash);
    await this.sessionCacheService.deleteSession(refreshTokenHash);

    this.recordSecurityEvent('LogoutSucceeded', {
      hasRefreshToken: true,
    });

    return {
      message: 'User logged out',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();

    await this.authRateLimitService.enforceForgotPassword(context, email);

    const user = await this.authRepository.findUserByEmail(email);

    if (user) {
      const otpCode = generateOtpCode();

      await this.otpService.storePasswordResetOtp({
        userId: user.id,
        otpCode,
        ttlSeconds: AUTH.passwordResetOtpTtlMinutes * 60,
      });

      await this.mailQueueService.enqueuePasswordResetOtp({
        email: user.email,
        otpCode,
      });
    }

    this.recordSecurityEvent('PasswordResetRequested', {
      userExists: Boolean(user),
      hasIp: Boolean(context.ip),
    });

    return {
      message: 'If the email exists, a password reset code has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto, context: AuthRequestContext) {
    const email = dto.email.trim().toLowerCase();

    await this.authRateLimitService.enforceResetPassword(context, email);

    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      this.recordSecurityEvent('PasswordResetFailed', {
        reason: 'user_not_found',
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid or expired password reset code');
    }

    const validOtp = await this.otpService.isValidPasswordResetOtp(
      user.id,
      dto.otpCode,
    );

    if (!validOtp) {
      this.recordSecurityEvent('PasswordResetFailed', {
        reason: 'invalid_otp',
        userId: user.id,
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid or expired password reset code');
    }

    const passwordHash = await hashPassword(dto.password);

    const { revokedSessions, tokenVersion } =
      await this.databaseService.transaction(async (tx) => {
        const updatedUser = await this.authRepository.updatePassword(
          user.id,
          passwordHash,
          tx,
        );

        if (!updatedUser) {
          this.recordSecurityEvent('PasswordResetFailed', {
            reason: 'password_update_failed',
            userId: user.id,
            hasIp: Boolean(context.ip),
          });

          throw new InternalServerErrorException('Failed to update password');
        }

        const revokedSessions = await this.authRepository.revokeUserSessions(
          user.id,
          tx,
        );

        return {
          revokedSessions,
          tokenVersion: updatedUser.tokenVersion,
        };
      });

    await Promise.all([
      this.otpService.deletePasswordResetOtp(user.id),
      this.authTokenVersionCacheService.set(user.id, tokenVersion),
      ...revokedSessions.map((session) =>
        this.sessionCacheService.deleteSession(session.refreshTokenHash),
      ),
    ]);

    this.recordSecurityEvent('PasswordResetSucceeded', {
      userId: user.id,
      revokedSessionCount: revokedSessions.length,
      hasIp: Boolean(context.ip),
    });

    return {
      message: 'Password reset successful',
    };
  }

  async getGoogleOAuthUrl() {
    this.recordSecurityEvent('OAuthStartRequested', {
      provider: 'google',
    });

    const state = await this.oauthStateService.createState('google');
    return this.oauthClientService.buildGoogleAuthorizationUrl(state);
  }

  async getDiscordOAuthUrl() {
    this.recordSecurityEvent('OAuthStartRequested', {
      provider: 'discord',
    });

    const state = await this.oauthStateService.createState('discord');
    return this.oauthClientService.buildDiscordAuthorizationUrl(state);
  }

  async handleGoogleOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    context: AuthRequestContext,
  ) {
    if (!code || !state) {
      this.recordSecurityEvent('OAuthFailed', {
        provider: 'google',
        reason: 'invalid_callback',
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid OAuth callback');
    }

    await this.oauthStateService.consumeState('google', state);

    const profile =
      await this.oauthClientService.exchangeGoogleCodeForProfile(code);

    const result = await this.loginOrCreateOAuthUser(profile, context);

    this.recordSecurityEvent('OAuthSucceeded', {
      provider: 'google',
      hasIp: Boolean(context.ip),
    });

    return {
      refreshToken: result.refreshToken,
      redirectUrl: this.configService.getOrThrow<string>(
        'OAUTH_SUCCESS_REDIRECT_URL',
      ),
    };
  }

  async handleDiscordOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    context: AuthRequestContext,
  ) {
    if (!code || !state) {
      this.recordSecurityEvent('OAuthFailed', {
        provider: 'discord',
        reason: 'invalid_callback',
        hasIp: Boolean(context.ip),
      });

      throw new BadRequestException('Invalid OAuth callback');
    }

    await this.oauthStateService.consumeState('discord', state);

    const profile =
      await this.oauthClientService.exchangeDiscordCodeForProfile(code);

    const result = await this.loginOrCreateOAuthUser(profile, context);

    this.recordSecurityEvent('OAuthSucceeded', {
      provider: 'discord',
      hasIp: Boolean(context.ip),
    });

    return {
      refreshToken: result.refreshToken,
      redirectUrl: this.configService.getOrThrow<string>(
        'OAUTH_SUCCESS_REDIRECT_URL',
      ),
    };
  }

  getOAuthFailureRedirectUrl() {
    return this.configService.getOrThrow<string>('OAUTH_FAILURE_REDIRECT_URL');
  }
}

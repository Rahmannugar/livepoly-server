import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { MailQueueService } from '../../mail/jobs/mail-queue.service';
import { OtpService } from '../../otp/otp.service';
import { SessionCacheService } from '../../session/session-cache.service';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { AuthTokenVersionCacheService } from '../auth-token-version-cache.service';
import { OAuthProvider, OAuthProfile } from '../auth.types';
import { OAuthClientService } from '../oauth-client.service';
import { OAuthStateService } from '../oauth-state.service';

jest.mock('../utils/utils', () => ({
  generateOpaqueToken: jest.fn(() => 'plain-refresh-token'),
  generateOtpCode: jest.fn(() => '123456'),
  hashPassword: jest.fn(async (password: string) => `hashed:${password}`),
  hashToken: jest.fn((token: string) => `hashed-token:${token}`),
  verifyPassword: jest.fn(async () => true),
}));

type FakeUser = {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  emailVerified: boolean;
  role: 'player' | 'admin';
  status: 'active' | 'suspended';
  tokenVersion: number;
};

type FakeOAuthAccount = {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  providerEmail: string;
};

type FakeSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type AuthUserForSession = {
  id: string;
  email: string;
  username: string;
  role: 'player' | 'admin';
  status: 'active' | 'suspended';
  tokenVersion: number;
  emailVerified?: boolean;
  passwordHash?: string | null;
  deletedAt?: Date | null;
};

type CreateOAuthUserInput = {
  email: string;
  username: string;
  provider: OAuthProvider;
  providerAccountId: string;
  providerEmail: string;
};

type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

type RevokedSession = {
  id: string;
  refreshTokenHash: string;
};

type Executor = unknown;

type AuthRepositoryMock = {
  findUserByOAuthAccount: jest.Mock<
    Promise<AuthUserForSession | null>,
    [OAuthProvider, string]
  >;
  updateOAuthAccountEmail: jest.Mock<
    Promise<void>,
    [
      {
        provider: OAuthProvider;
        providerAccountId: string;
        providerEmail: string;
      },
      Executor?,
    ]
  >;
  findUserByEmail: jest.Mock<Promise<AuthUserForSession | null>, [string]>;
  linkOAuthAccount: jest.Mock<
    Promise<void>,
    [
      {
        userId: string;
        provider: OAuthProvider;
        providerAccountId: string;
        providerEmail: string;
      },
      Executor?,
    ]
  >;
  markEmailVerified: jest.Mock<Promise<void>, [string, Executor?]>;
  findUserByUsername: jest.Mock<Promise<{ id: string } | null>, [string]>;
  createOAuthUser: jest.Mock<
    Promise<AuthUserForSession>,
    [CreateOAuthUserInput, Executor?]
  >;
  countActiveSessions: jest.Mock<Promise<number>, [string, Executor?]>;
  revokeOldestActiveSession: jest.Mock<
    Promise<RevokedSession | undefined>,
    [string, Executor?]
  >;
  createSession: jest.Mock<
    Promise<{
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    }>,
    [CreateSessionInput, Executor?]
  >;
  updatePassword: jest.Mock<
    Promise<{ tokenVersion: number } | undefined>,
    [string, string, Executor?]
  >;
  findActiveSessionByRefreshTokenHash: jest.Mock<
    Promise<{
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    } | null>,
    [string]
  >;
  findUserByIdForAuthToken: jest.Mock<
    Promise<AuthUserForSession | null>,
    [string]
  >;
  rotateSessionRefreshToken: jest.Mock<
    Promise<{
      id: string;
      userId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    } | null>,
    [
      {
        sessionId: string;
        currentRefreshTokenHash: string;
        nextRefreshTokenHash: string;
        expiresAt: Date;
      },
      Executor?,
    ]
  >;
  revokeUserSessions: jest.Mock<Promise<RevokedSession[]>, [string, Executor?]>;
};

type OtpServiceMock = {
  isValidPasswordResetOtp: jest.Mock<Promise<boolean>, [string, string]>;
  deletePasswordResetOtp: jest.Mock<Promise<void>, [string]>;
  storeEmailVerificationOtp: jest.Mock<Promise<void>, [unknown]>;
  deleteEmailVerificationOtp: jest.Mock<Promise<void>, [string]>;
  isValidEmailVerificationOtp: jest.Mock<Promise<boolean>, [string, string]>;
};

type SessionCacheServiceMock = {
  withUserSessionLock<T>(
    userId: string,
    callback: () => Promise<T>,
  ): Promise<T>;
  storeSession: jest.Mock<Promise<void>, [unknown]>;
  deleteSession: jest.Mock<Promise<void>, [string]>;
  getSession: jest.Mock<Promise<unknown>, [string]>;
};

type AuthTokenVersionCacheServiceMock = {
  set: jest.Mock<Promise<void>, [string, number]>;
  get: jest.Mock<Promise<number | null>, [string]>;
  delete: jest.Mock<Promise<void>, [string]>;
};

type OAuthClientServiceMock = {
  exchangeGoogleCodeForProfile: jest.Mock<Promise<OAuthProfile>, [string]>;
  exchangeDiscordCodeForProfile: jest.Mock<Promise<OAuthProfile>, [string]>;
  buildGoogleAuthorizationUrl: jest.Mock<string, [string]>;
  buildDiscordAuthorizationUrl: jest.Mock<string, [string]>;
};

type OAuthStateServiceMock = {
  consumeState: jest.Mock<Promise<void>, [OAuthProvider, string]>;
  createState: jest.Mock<Promise<string>, [OAuthProvider]>;
};

type DatabaseServiceMock = {
  transaction<T>(callback: (tx: Executor) => Promise<T>): Promise<T>;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock<
    void,
    [string, Record<string, string | number | boolean | null | undefined>?]
  >;
};

describe('AuthService', () => {
  let service: AuthService;

  let users: FakeUser[];
  let oauthAccounts: FakeOAuthAccount[];
  let sessions: FakeSession[];

  let authRepository: AuthRepositoryMock;
  let otpService: OtpServiceMock;
  let sessionCacheService: SessionCacheServiceMock;
  let authTokenVersionCacheService: AuthTokenVersionCacheServiceMock;
  let oauthClientService: OAuthClientServiceMock;
  let oauthStateService: OAuthStateServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const tx: Executor = Symbol('tx');

  beforeEach(() => {
    users = [];
    oauthAccounts = [];
    sessions = [];

    authRepository = {
      findUserByOAuthAccount: jest.fn(async (provider, providerAccountId) => {
        const account = oauthAccounts.find(
          (item) =>
            item.provider === provider &&
            item.providerAccountId === providerAccountId,
        );

        if (!account) return null;

        const user = users.find((item) => item.id === account.userId);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
        };
      }),

      updateOAuthAccountEmail: jest.fn(async (input) => {
        const account = oauthAccounts.find(
          (item) =>
            item.provider === input.provider &&
            item.providerAccountId === input.providerAccountId,
        );

        if (account) {
          account.providerEmail = input.providerEmail;
        }
      }),

      findUserByEmail: jest.fn(async (email) => {
        const user = users.find((item) => item.email === email);

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          passwordHash: user.passwordHash,
          emailVerified: user.emailVerified,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
        };
      }),

      linkOAuthAccount: jest.fn(async (input) => {
        oauthAccounts.push({ ...input });
      }),

      markEmailVerified: jest.fn(async (userId) => {
        const user = users.find((item) => item.id === userId);

        if (user) {
          user.emailVerified = true;
        }
      }),

      findUserByUsername: jest.fn(async (username) => {
        const user = users.find((item) => item.username === username);
        return user ? { id: user.id } : null;
      }),

      createOAuthUser: jest.fn(async (input) => {
        const user: FakeUser = {
          id: `user-${users.length + 1}`,
          email: input.email,
          username: input.username,
          passwordHash: null,
          emailVerified: true,
          role: 'player',
          status: 'active',
          tokenVersion: 0,
        };

        users.push(user);
        oauthAccounts.push({
          userId: user.id,
          provider: input.provider,
          providerAccountId: input.providerAccountId,
          providerEmail: input.providerEmail,
        });

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
        };
      }),

      countActiveSessions: jest.fn(async (userId) => {
        return sessions.filter(
          (session) => session.userId === userId && !session.revokedAt,
        ).length;
      }),

      revokeOldestActiveSession: jest.fn(async (userId) => {
        const session = sessions.find(
          (item) => item.userId === userId && !item.revokedAt,
        );

        if (!session) return undefined;

        session.revokedAt = new Date();

        return {
          id: session.id,
          refreshTokenHash: session.refreshTokenHash,
        };
      }),

      createSession: jest.fn(async (input) => {
        const session: FakeSession = {
          id: `session-${sessions.length + 1}`,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          revokedAt: null,
        };

        sessions.push(session);

        return {
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        };
      }),

      updatePassword: jest.fn(async (userId, passwordHash) => {
        const user = users.find((item) => item.id === userId);

        if (!user) return undefined;

        user.passwordHash = passwordHash;
        user.tokenVersion += 1;

        return {
          tokenVersion: user.tokenVersion,
        };
      }),

      findActiveSessionByRefreshTokenHash: jest.fn(async (refreshTokenHash) => {
        const session = sessions.find(
          (item) =>
            item.refreshTokenHash === refreshTokenHash && !item.revokedAt,
        );

        if (!session) return null;

        return {
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        };
      }),

      findUserByIdForAuthToken: jest.fn(async (userId) => {
        const user = users.find((item) => item.id === userId);

        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
          deletedAt: null,
        };
      }),

      rotateSessionRefreshToken: jest.fn(async (input) => {
        const session = sessions.find(
          (item) =>
            item.id === input.sessionId &&
            item.refreshTokenHash === input.currentRefreshTokenHash &&
            !item.revokedAt,
        );

        if (!session) return null;

        session.refreshTokenHash = input.nextRefreshTokenHash;
        session.expiresAt = input.expiresAt;

        return {
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        };
      }),

      revokeUserSessions: jest.fn(async (userId) => {
        return sessions
          .filter((session) => session.userId === userId && !session.revokedAt)
          .map((session) => {
            session.revokedAt = new Date();

            return {
              id: session.id,
              refreshTokenHash: session.refreshTokenHash,
            };
          });
      }),
    };

    otpService = {
      isValidPasswordResetOtp: jest.fn<Promise<boolean>, [string, string]>(
        async () => true,
      ),
      deletePasswordResetOtp: jest.fn<Promise<void>, [string]>(
        async () => undefined,
      ),
      storeEmailVerificationOtp: jest.fn<Promise<void>, [unknown]>(
        async () => undefined,
      ),
      deleteEmailVerificationOtp: jest.fn<Promise<void>, [string]>(
        async () => undefined,
      ),
      isValidEmailVerificationOtp: jest.fn<Promise<boolean>, [string, string]>(
        async () => true,
      ),
    };

    sessionCacheService = {
      withUserSessionLock: async <T>(
        _userId: string,
        callback: () => Promise<T>,
      ) => callback(),
      storeSession: jest.fn<Promise<void>, [unknown]>(async () => undefined),
      deleteSession: jest.fn<Promise<void>, [string]>(async () => undefined),
      getSession: jest.fn<Promise<unknown>, [string]>(async () => null),
    };

    authTokenVersionCacheService = {
      set: jest.fn<Promise<void>, [string, number]>(async () => undefined),
      get: jest.fn<Promise<number | null>, [string]>(async () => null),
      delete: jest.fn<Promise<void>, [string]>(async () => undefined),
    };

    oauthClientService = {
      exchangeGoogleCodeForProfile: jest.fn(),
      exchangeDiscordCodeForProfile: jest.fn(),
      buildGoogleAuthorizationUrl: jest.fn(),
      buildDiscordAuthorizationUrl: jest.fn(),
    };

    oauthStateService = {
      consumeState: jest.fn<Promise<void>, [OAuthProvider, string]>(
        async () => undefined,
      ),
      createState: jest.fn<Promise<string>, [OAuthProvider]>(
        async () => 'oauth-state',
      ),
    };

    const mailQueueService = {
      enqueueEmailVerificationOtp: jest.fn(async () => undefined),
      enqueuePasswordResetOtp: jest.fn(async () => undefined),
    };

    const jwtService = {
      signAsync: jest.fn(async () => 'access-token'),
    };

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'x'.repeat(32),
          OAUTH_SUCCESS_REDIRECT_URL: 'http://localhost:5173/auth/callback',
          OAUTH_FAILURE_REDIRECT_URL:
            'http://localhost:5173/auth/callback?error=oauth_failed',
        };

        return values[key];
      }),
    };

    const databaseService: DatabaseServiceMock = {
      transaction: async <T>(callback: (executor: Executor) => Promise<T>) =>
        callback(tx),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn<
        void,
        [string, Record<string, string | number | boolean | null | undefined>?]
      >(),
    };

    service = new AuthService(
      authRepository as unknown as AuthRepository,
      mailQueueService as unknown as MailQueueService,
      otpService as unknown as OtpService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      sessionCacheService as unknown as SessionCacheService,
      databaseService as unknown as DatabaseService,
      oauthClientService as unknown as OAuthClientService,
      oauthStateService as unknown as OAuthStateService,
      authTokenVersionCacheService as unknown as AuthTokenVersionCacheService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('links google and discord with the same verified email to one user', async () => {
    oauthClientService.exchangeGoogleCodeForProfile.mockResolvedValue({
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'player@example.com',
      emailVerified: true,
      usernameSeed: 'player',
    });

    oauthClientService.exchangeDiscordCodeForProfile.mockResolvedValue({
      provider: 'discord',
      providerAccountId: 'discord-456',
      email: 'player@example.com',
      emailVerified: true,
      usernameSeed: 'playerdiscord',
    });

    const googleResult = await service.handleGoogleOAuthCallback(
      'google-code',
      'google-state',
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    const discordResult = await service.handleDiscordOAuthCallback(
      'discord-code',
      'discord-state',
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(googleResult.refreshToken).toBe('plain-refresh-token');
    expect(discordResult.refreshToken).toBe('plain-refresh-token');

    expect(users).toHaveLength(1);
    expect(oauthAccounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: users[0].id,
          provider: 'google',
          providerAccountId: 'google-123',
        }),
        expect.objectContaining({
          userId: users[0].id,
          provider: 'discord',
          providerAccountId: 'discord-456',
        }),
      ]),
    );

    expect(authRepository.createOAuthUser).toHaveBeenCalledTimes(1);
    expect(authRepository.linkOAuthAccount).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.userId === users[0].id)).toBe(
      true,
    );
  });

  it('logs in by provider identity when provider email changes', async () => {
    users.push({
      id: 'user-1',
      email: 'old@example.com',
      username: 'player',
      passwordHash: null,
      emailVerified: true,
      role: 'player',
      status: 'active',
      tokenVersion: 2,
    });

    oauthAccounts.push({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-123',
      providerEmail: 'old@example.com',
    });

    oauthClientService.exchangeGoogleCodeForProfile.mockResolvedValue({
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'new@example.com',
      emailVerified: true,
      usernameSeed: 'newplayer',
    });

    await service.handleGoogleOAuthCallback('google-code', 'google-state', {
      ip: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user-1');

    expect(oauthAccounts).toHaveLength(1);
    expect(oauthAccounts[0]).toMatchObject({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-123',
      providerEmail: 'new@example.com',
    });

    expect(authRepository.createOAuthUser).not.toHaveBeenCalled();
    expect(authRepository.linkOAuthAccount).not.toHaveBeenCalled();
    expect(authRepository.updateOAuthAccountEmail).toHaveBeenCalledWith({
      provider: 'google',
      providerAccountId: 'google-123',
      providerEmail: 'new@example.com',
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].userId).toBe('user-1');
  });

  it('rejects suspended password login', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'password-hash',
      emailVerified: true,
      role: 'player',
      status: 'suspended',
      tokenVersion: 0,
    });

    await expect(
      service.login(
        {
          email: 'player@example.com',
          password: 'StrongPass123',
        },
        { ip: '127.0.0.1', userAgent: 'jest' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessions).toHaveLength(0);
  });

  it('rejects suspended oauth login', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: null,
      emailVerified: true,
      role: 'player',
      status: 'suspended',
      tokenVersion: 0,
    });

    oauthAccounts.push({
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-123',
      providerEmail: 'player@example.com',
    });

    oauthClientService.exchangeGoogleCodeForProfile.mockResolvedValue({
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'player@example.com',
      emailVerified: true,
      usernameSeed: 'player',
    });

    await expect(
      service.handleGoogleOAuthCallback('google-code', 'google-state', {
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessions).toHaveLength(0);
  });

  it('rejects suspended refresh', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'password-hash',
      emailVerified: true,
      role: 'player',
      status: 'suspended',
      tokenVersion: 0,
    });

    sessions.push({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed-token:plain-refresh-token',
      expiresAt: new Date(Date.now() + 100_000),
      revokedAt: null,
    });

    await expect(service.refresh('plain-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authRepository.rotateSessionRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes sessions and clears session cache after password reset', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'old-hash',
      emailVerified: true,
      role: 'player',
      status: 'active',
      tokenVersion: 0,
    });

    sessions.push(
      {
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'refresh-hash-1',
        expiresAt: new Date(Date.now() + 100_000),
        revokedAt: null,
      },
      {
        id: 'session-2',
        userId: 'user-1',
        refreshTokenHash: 'refresh-hash-2',
        expiresAt: new Date(Date.now() + 100_000),
        revokedAt: null,
      },
    );

    await service.resetPassword(
      {
        email: 'player@example.com',
        otpCode: '123456',
        password: 'NewStrongPass123',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(otpService.isValidPasswordResetOtp).toHaveBeenCalledWith(
      'user-1',
      '123456',
    );

    expect(users[0].passwordHash).toBe('hashed:NewStrongPass123');
    expect(users[0].tokenVersion).toBe(1);

    expect(sessions.every((session) => session.revokedAt)).toBe(true);

    expect(sessionCacheService.deleteSession).toHaveBeenCalledWith(
      'refresh-hash-1',
    );
    expect(sessionCacheService.deleteSession).toHaveBeenCalledWith(
      'refresh-hash-2',
    );

    expect(otpService.deletePasswordResetOtp).toHaveBeenCalledWith('user-1');
    expect(authTokenVersionCacheService.set).toHaveBeenCalledWith('user-1', 1);
  });

  it('rejects oauth when provider email is not verified', async () => {
    oauthClientService.exchangeGoogleCodeForProfile.mockResolvedValue({
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'player@example.com',
      emailVerified: false,
      usernameSeed: 'player',
    });

    await expect(
      service.handleGoogleOAuthCallback('google-code', 'google-state', {
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(users).toHaveLength(0);
    expect(oauthAccounts).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });
});

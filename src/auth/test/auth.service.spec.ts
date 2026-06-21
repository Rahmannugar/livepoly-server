import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CacheService } from '../../infra/cache/cache.service';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { MailQueueService } from '../../mail/jobs/mail-queue.service';
import { OtpService } from '../../otp/otp.service';
import { SessionCacheService } from '../../session/session-cache.service';
import { USER_SEARCH } from '../../users/users.constants';
import { AUTH_ERROR_CODES } from '../auth.constants';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { AuthTokenVersionCacheService } from '../auth-token-version-cache.service';
import { OAuthProvider, OAuthProfile } from '../auth.types';
import { OAuthClientService } from '../oauth-client.service';
import { OAuthStateService } from '../oauth-state.service';

jest.mock('../utils/utils', () => ({
  generateOpaqueToken: jest.fn(() => 'plain-refresh-token'),
  generateOtpCode: jest.fn(() => '123456'),
  hashPassword: jest.fn((password: string) =>
    Promise.resolve(`hashed:${password}`),
  ),
  hashToken: jest.fn((token: string) => `hashed-token:${token}`),
  verifyPassword: jest.fn(() => Promise.resolve(true)),
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
  deletedAt?: Date | null;
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
  findUserByEmailOrUsername: jest.Mock<
    Promise<{ id: string; email: string; username: string } | null>,
    [string, string]
  >;
  createUser: jest.Mock<
    Promise<{ id: string; email: string; username: string }>,
    [{ email: string; username: string; passwordHash: string }]
  >;
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

type CacheServiceMock = {
  getClient: jest.Mock<{
    incr: jest.Mock<Promise<number>, [string]>;
  }>;
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
  let cacheService: CacheServiceMock;
  let cacheIncr: jest.Mock<Promise<number>, [string]>;

  const tx: Executor = Symbol('tx');

  beforeEach(() => {
    users = [];
    oauthAccounts = [];
    sessions = [];

    authRepository = {
      findUserByEmailOrUsername: jest.fn((email, username) => {
        const user = users.find(
          (item) => item.email === email || item.username === username,
        );

        if (!user) return Promise.resolve(null);

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
        });
      }),

      createUser: jest.fn((input) => {
        const user: FakeUser = {
          id: `user-${users.length + 1}`,
          email: input.email,
          username: input.username,
          passwordHash: input.passwordHash,
          emailVerified: false,
          role: 'player',
          status: 'active',
          tokenVersion: 0,
        };

        users.push(user);

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
        });
      }),

      findUserByOAuthAccount: jest.fn((provider, providerAccountId) => {
        const account = oauthAccounts.find(
          (item) =>
            item.provider === provider &&
            item.providerAccountId === providerAccountId,
        );

        if (!account) return Promise.resolve(null);

        const user = users.find((item) => item.id === account.userId);
        if (!user) return Promise.resolve(null);

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
          deletedAt: user.deletedAt ?? null,
        });
      }),

      updateOAuthAccountEmail: jest.fn((input) => {
        const account = oauthAccounts.find(
          (item) =>
            item.provider === input.provider &&
            item.providerAccountId === input.providerAccountId,
        );

        if (account) {
          account.providerEmail = input.providerEmail;
        }

        return Promise.resolve();
      }),

      findUserByEmail: jest.fn((email) => {
        const user = users.find((item) => item.email === email);

        if (!user) return Promise.resolve(null);

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
          passwordHash: user.passwordHash,
          emailVerified: user.emailVerified,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          deletedAt: user.deletedAt ?? null,
        });
      }),

      linkOAuthAccount: jest.fn((input) => {
        oauthAccounts.push({ ...input });
        return Promise.resolve();
      }),

      markEmailVerified: jest.fn((userId) => {
        const user = users.find((item) => item.id === userId);

        if (user) {
          user.emailVerified = true;
        }

        return Promise.resolve();
      }),

      findUserByUsername: jest.fn((username) => {
        const user = users.find((item) => item.username === username);
        return Promise.resolve(user ? { id: user.id } : null);
      }),

      createOAuthUser: jest.fn((input) => {
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

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
        });
      }),

      countActiveSessions: jest.fn((userId) =>
        Promise.resolve(
          sessions.filter(
            (session) => session.userId === userId && !session.revokedAt,
          ).length,
        ),
      ),

      revokeOldestActiveSession: jest.fn((userId) => {
        const session = sessions.find(
          (item) => item.userId === userId && !item.revokedAt,
        );

        if (!session) return Promise.resolve(undefined);

        session.revokedAt = new Date();

        return Promise.resolve({
          id: session.id,
          refreshTokenHash: session.refreshTokenHash,
        });
      }),

      createSession: jest.fn((input) => {
        const session: FakeSession = {
          id: `session-${sessions.length + 1}`,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          revokedAt: null,
        };

        sessions.push(session);

        return Promise.resolve({
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        });
      }),

      updatePassword: jest.fn((userId, passwordHash) => {
        const user = users.find((item) => item.id === userId);

        if (!user) return Promise.resolve(undefined);

        user.passwordHash = passwordHash;
        user.tokenVersion += 1;

        return Promise.resolve({
          tokenVersion: user.tokenVersion,
        });
      }),

      findActiveSessionByRefreshTokenHash: jest.fn((refreshTokenHash) => {
        const session = sessions.find(
          (item) =>
            item.refreshTokenHash === refreshTokenHash && !item.revokedAt,
        );

        if (!session) return Promise.resolve(null);

        return Promise.resolve({
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        });
      }),

      findUserByIdForAuthToken: jest.fn((userId) => {
        const user = users.find((item) => item.id === userId);

        if (!user) return Promise.resolve(null);

        return Promise.resolve({
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status,
          tokenVersion: user.tokenVersion,
          emailVerified: user.emailVerified,
          deletedAt: null,
        });
      }),

      rotateSessionRefreshToken: jest.fn((input) => {
        const session = sessions.find(
          (item) =>
            item.id === input.sessionId &&
            item.refreshTokenHash === input.currentRefreshTokenHash &&
            !item.revokedAt,
        );

        if (!session) return Promise.resolve(null);

        session.refreshTokenHash = input.nextRefreshTokenHash;
        session.expiresAt = input.expiresAt;

        return Promise.resolve({
          id: session.id,
          userId: session.userId,
          refreshTokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
        });
      }),

      revokeUserSessions: jest.fn((userId) =>
        Promise.resolve(
          sessions
            .filter(
              (session) => session.userId === userId && !session.revokedAt,
            )
            .map((session) => {
              session.revokedAt = new Date();

              return {
                id: session.id,
                refreshTokenHash: session.refreshTokenHash,
              };
            }),
        ),
      ),
    };

    otpService = {
      isValidPasswordResetOtp: jest.fn<Promise<boolean>, [string, string]>(() =>
        Promise.resolve(true),
      ),
      deletePasswordResetOtp: jest.fn<Promise<void>, [string]>(() =>
        Promise.resolve(),
      ),
      storeEmailVerificationOtp: jest.fn<Promise<void>, [unknown]>(() =>
        Promise.resolve(),
      ),
      deleteEmailVerificationOtp: jest.fn<Promise<void>, [string]>(() =>
        Promise.resolve(),
      ),
      isValidEmailVerificationOtp: jest.fn<Promise<boolean>, [string, string]>(
        () => Promise.resolve(true),
      ),
    };

    sessionCacheService = {
      withUserSessionLock: <T>(_userId: string, callback: () => Promise<T>) =>
        callback(),
      storeSession: jest.fn<Promise<void>, [unknown]>(() => Promise.resolve()),
      deleteSession: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
      getSession: jest.fn<Promise<unknown>, [string]>(() =>
        Promise.resolve(null),
      ),
    };

    authTokenVersionCacheService = {
      set: jest.fn<Promise<void>, [string, number]>(() => Promise.resolve()),
      get: jest.fn<Promise<number | null>, [string]>(() =>
        Promise.resolve(null),
      ),
      delete: jest.fn<Promise<void>, [string]>(() => Promise.resolve()),
    };

    oauthClientService = {
      exchangeGoogleCodeForProfile: jest.fn<Promise<OAuthProfile>, [string]>(),
      exchangeDiscordCodeForProfile: jest.fn<Promise<OAuthProfile>, [string]>(),
      buildGoogleAuthorizationUrl: jest.fn<string, [string]>(),
      buildDiscordAuthorizationUrl: jest.fn<string, [string]>(),
    };

    oauthStateService = {
      consumeState: jest.fn<Promise<void>, [OAuthProvider, string]>(() =>
        Promise.resolve(),
      ),
      createState: jest.fn<Promise<string>, [OAuthProvider]>(() =>
        Promise.resolve('oauth-state'),
      ),
    };

    const mailQueueService = {
      enqueueEmailVerificationOtp: jest.fn(() => Promise.resolve()),
      enqueuePasswordResetOtp: jest.fn(() => Promise.resolve()),
    };

    const jwtService = {
      signAsync: jest.fn(() => Promise.resolve('access-token')),
    };

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'x'.repeat(32),
          OAUTH_SUCCESS_REDIRECT_URL: 'http://localhost:5173/',
          OAUTH_FAILURE_REDIRECT_URL:
            'http://localhost:5173/auth/login?oauth=failed',
        };

        return values[key];
      }),
    };

    const databaseService: DatabaseServiceMock = {
      transaction: <T>(callback: (executor: Executor) => Promise<T>) =>
        callback(tx),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn<
        void,
        [string, Record<string, string | number | boolean | null | undefined>?]
      >(),
    };

    cacheIncr = jest.fn<Promise<number>, [string]>(() => Promise.resolve(2));
    cacheService = {
      getClient: jest.fn(() => ({
        incr: cacheIncr,
      })),
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
      cacheService as unknown as CacheService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('bumps user search cache after signup', async () => {
    await service.signup(
      {
        email: 'NewPlayer@Example.com',
        username: 'newplayer',
        password: 'StrongPass123',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: 'newplayer@example.com',
      username: 'newplayer',
      emailVerified: false,
    });
    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
  });

  it('resends verification when signup is retried for an unverified email', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'password-hash',
      emailVerified: false,
      role: 'player',
      status: 'active',
      tokenVersion: 0,
    });

    const result = await service.signup(
      {
        email: 'player@example.com',
        username: 'player2',
        password: 'StrongPass123',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(result).toEqual({ message: 'Verification code sent' });
    expect(users).toHaveLength(1);
    expect(authRepository.createUser).not.toHaveBeenCalled();
    expect(otpService.storeEmailVerificationOtp).toHaveBeenCalledWith({
      userId: 'user-1',
      otpCode: '123456',
      ttlSeconds: 900,
    });
  });

  it('bumps user search cache when email verification makes a user discoverable', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'playerone',
      passwordHash: 'password-hash',
      emailVerified: false,
      role: 'player',
      status: 'active',
      tokenVersion: 0,
    });

    await service.verifyEmail(
      {
        email: 'player@example.com',
        otpCode: '123456',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(users[0].emailVerified).toBe(true);
    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
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
    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
    expect(cacheIncr).toHaveBeenCalledTimes(1);
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

  it('rejects deleted password login without creating a session', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'password-hash',
      emailVerified: true,
      role: 'player',
      status: 'active',
      tokenVersion: 0,
      deletedAt: new Date('2026-06-21T12:00:00.000Z'),
    });

    const loginAttempt = service.login(
      {
        email: 'player@example.com',
        password: 'StrongPass123',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    await expect(loginAttempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(loginAttempt).rejects.toMatchObject({
      response: {
        message: 'Unable to sign in',
      },
    });

    expect(sessions).toHaveLength(0);
  });

  it('resends verification and returns a specific code for unverified password login', async () => {
    users.push({
      id: 'user-1',
      email: 'player@example.com',
      username: 'player',
      passwordHash: 'password-hash',
      emailVerified: false,
      role: 'player',
      status: 'active',
      tokenVersion: 0,
    });

    const loginAttempt = service.login(
      {
        email: 'player@example.com',
        password: 'StrongPass123',
      },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    await expect(loginAttempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(loginAttempt).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_CODES.emailVerificationRequired,
        message: 'Email verification required',
      },
    });

    expect(sessions).toHaveLength(0);
    expect(otpService.storeEmailVerificationOtp).toHaveBeenCalledWith({
      userId: 'user-1',
      otpCode: '123456',
      ttlSeconds: 900,
    });
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

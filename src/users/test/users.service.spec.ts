import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { UsersRepository } from '../users.repository';
import { AuthRepository } from '../../auth/auth.repository';
import { SessionCacheService } from '../../session/session-cache.service';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { UsersRateLimitService } from '../users-rate-limit.service';
import { UsersQueueService } from '../jobs/users-queue.service';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ConfigService } from '@nestjs/config';

type UsersRepositoryMock = {
  findActiveUserById: jest.Mock;
  findActiveUserByUsername: jest.Mock;
  findUserByUsername: jest.Mock;
  updateUser: jest.Mock;
  deleteUser: jest.Mock;
};

type AuthRepositoryMock = {
  revokeUserSessions: jest.Mock;
};

type SessionCacheServiceMock = {
  deleteSession: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type UsersRateLimitServiceMock = {
  enforceGetMe: jest.Mock;
  enforceUpdateMe: jest.Mock;
  enforceDeleteMe: jest.Mock;
  enforceGetPublicProfile: jest.Mock;
};

type UsersQueueServiceMock = {
  enqueueDeletedUserCleanup: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const context = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: UsersRepositoryMock;
  let authRepository: AuthRepositoryMock;
  let sessionCacheService: SessionCacheServiceMock;
  let databaseService: DatabaseServiceMock;
  let configService: ConfigServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let usersRateLimitService: UsersRateLimitServiceMock;
  let usersQueueService: UsersQueueServiceMock;

  beforeEach(() => {
    usersRepository = {
      findActiveUserById: jest.fn(),
      findActiveUserByUsername: jest.fn(),
      findUserByUsername: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    authRepository = {
      revokeUserSessions: jest.fn(),
    };

    sessionCacheService = {
      deleteSession: jest.fn(),
    };

    databaseService = {
      transaction: jest.fn(async (callback) => callback({ tx: true })),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    usersRateLimitService = {
      enforceGetMe: jest.fn().mockResolvedValue(undefined),
      enforceUpdateMe: jest.fn().mockResolvedValue(undefined),
      enforceDeleteMe: jest.fn().mockResolvedValue(undefined),
      enforceGetPublicProfile: jest.fn().mockResolvedValue(undefined),
    };

    usersQueueService = {
      enqueueDeletedUserCleanup: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      usersRepository as unknown as UsersRepository,
      authRepository as unknown as AuthRepository,
      sessionCacheService as unknown as SessionCacheService,
      databaseService as unknown as DatabaseService,
      configService as unknown as ConfigService,
      observabilityService as unknown as ObservabilityService,
      usersRateLimitService as unknown as UsersRateLimitService,
      usersQueueService as unknown as UsersQueueService,
    );
  });

  it('rejects username update when a deleted user still owns the username', async () => {
    usersRepository.findUserByUsername.mockResolvedValue({
      id: 'deleted-user',
    });

    await expect(
      service.updateMe(authUser, { username: 'takenname' }, context),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersRepository.updateUser).not.toHaveBeenCalled();
  });

  it('maps username unique race to conflict', async () => {
    usersRepository.findUserByUsername.mockResolvedValue(null);

    usersRepository.updateUser.mockRejectedValue({
      code: '23505',
      constraint_name: 'users_username_unique_idx',
    });

    await expect(
      service.updateMe(authUser, { username: 'takenname' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('soft deletes user, revokes sessions, clears cache, and enqueues cleanup', async () => {
    usersRepository.deleteUser.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      avatarObjectKey: 'avatars/user-1/avatar.webp',
    });

    authRepository.revokeUserSessions.mockResolvedValue([
      { refreshTokenHash: 'hash-1' },
      { refreshTokenHash: 'hash-2' },
    ]);

    await service.deleteMe(authUser, context);

    expect(usersRepository.deleteUser).toHaveBeenCalledWith(authUser.id, {
      tx: true,
    });

    expect(authRepository.revokeUserSessions).toHaveBeenCalledWith(
      authUser.id,
      { tx: true },
    );

    expect(sessionCacheService.deleteSession).toHaveBeenCalledWith('hash-1');
    expect(sessionCacheService.deleteSession).toHaveBeenCalledWith('hash-2');

    expect(usersQueueService.enqueueDeletedUserCleanup).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authUser.id,
        email: authUser.email,
        username: authUser.username,
        avatarObjectKey: 'avatars/user-1/avatar.webp',
      }),
    );
  });

  it('does not return deleted users in public profile lookup', async () => {
    usersRepository.findActiveUserByUsername.mockResolvedValue(null);

    await expect(
      service.getByUsername('playerone', context),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(usersRepository.findActiveUserByUsername).toHaveBeenCalledWith(
      'playerone',
    );
  });
});

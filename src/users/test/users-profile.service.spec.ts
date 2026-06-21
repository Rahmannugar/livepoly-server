import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthRepository } from '../../auth/auth.repository';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { CacheService } from '../../infra/cache/cache.service';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { SessionCacheService } from '../../session/session-cache.service';
import type { UsersQueueService } from '../jobs/users-queue.service';
import type { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersProfileService } from '../services/users-profile.service';
import type { UsersStatsService } from '../services/users-stats.service';
import { USER_SEARCH } from '../users.constants';

type UsersProfileRepositoryMock = {
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

type UsersQueueServiceMock = {
  enqueueDeletedUserCleanup: jest.Mock;
};

type CacheServiceMock = {
  getClient: jest.Mock;
  getOrSet: jest.Mock;
};

type UsersStatsServiceMock = {
  getStats: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  role: 'player',
  status: 'active',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  averagePlacement: null,
  rating: 500,
};

describe('UsersProfileService', () => {
  let service: UsersProfileService;
  let usersProfileRepository: UsersProfileRepositoryMock;
  let authRepository: AuthRepositoryMock;
  let sessionCacheService: SessionCacheServiceMock;
  let databaseService: DatabaseServiceMock;
  let configService: ConfigServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let usersQueueService: UsersQueueServiceMock;
  let cacheService: CacheServiceMock;
  let usersStatsService: UsersStatsServiceMock;
  let cacheIncr: jest.Mock;

  beforeEach(() => {
    usersProfileRepository = {
      findActiveUserById: jest.fn(),
      findActiveUserByUsername: jest.fn(),
      findUserByUsername: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    usersStatsService = {
      getStats: jest.fn().mockResolvedValue(stats),
    };

    authRepository = {
      revokeUserSessions: jest.fn(),
    };

    sessionCacheService = {
      deleteSession: jest.fn(),
    };

    databaseService = {
      transaction: jest.fn(
        (callback: (transaction: { tx: boolean }) => Promise<unknown>) =>
          callback({ tx: true }),
      ),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    usersQueueService = {
      enqueueDeletedUserCleanup: jest.fn().mockResolvedValue(undefined),
    };

    cacheIncr = jest.fn().mockResolvedValue(2);
    cacheService = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(null),
        incr: cacheIncr,
      }),
      getOrSet: jest.fn(),
    };

    service = new UsersProfileService(
      usersProfileRepository as unknown as UsersProfileRepository,
      usersStatsService as unknown as UsersStatsService,
      authRepository as unknown as AuthRepository,
      sessionCacheService as unknown as SessionCacheService,
      databaseService as unknown as DatabaseService,
      configService as unknown as ConfigService,
      usersQueueService as unknown as UsersQueueService,
      cacheService as unknown as CacheService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('rejects username update when a deleted user still owns the username', async () => {
    usersProfileRepository.findUserByUsername.mockResolvedValue({
      id: 'deleted-user',
    });

    await expect(
      service.updateMe(authUser, { username: 'takenname' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersProfileRepository.updateUser).not.toHaveBeenCalled();
  });

  it('bumps user search cache after profile update', async () => {
    usersProfileRepository.findUserByUsername.mockResolvedValue(null);
    usersProfileRepository.updateUser.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: 'renamed',
      bio: 'New table energy.',
      avatarObjectKey: 'avatars/user-1/avatar.webp',
      createdAt: new Date('2026-05-14T12:00:00.000Z'),
      updatedAt: new Date('2026-05-14T12:15:00.000Z'),
    });

    await service.updateMe(authUser, {
      username: 'renamed',
      bio: 'New table energy.',
    });

    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
  });

  it('soft deletes user, revokes sessions, clears cache, and enqueues cleanup', async () => {
    usersProfileRepository.deleteUser.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      avatarObjectKey: 'avatars/user-1/avatar.webp',
    });

    authRepository.revokeUserSessions.mockResolvedValue([
      { refreshTokenHash: 'hash-1' },
      { refreshTokenHash: 'hash-2' },
    ]);

    await service.deleteMe(authUser);

    expect(usersProfileRepository.deleteUser).toHaveBeenCalledWith(
      authUser.id,
      { tx: true },
    );

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
    expect(cacheIncr).toHaveBeenCalledWith(USER_SEARCH.cacheVersionKey);
  });

  it('returns public profile without email by username', async () => {
    usersProfileRepository.findActiveUserByUsername.mockResolvedValue({
      id: 'user-2',
      email: 'private@example.com',
      username: 'playertwo',
      bio: 'Buying the board.',
      avatarObjectKey: 'avatars/user-2/avatar.webp',
      createdAt: new Date('2026-05-14T12:00:00.000Z'),
      updatedAt: new Date('2026-05-14T12:15:00.000Z'),
    });

    const result = await service.getByUsername('PlayerTwo');

    expect(
      usersProfileRepository.findActiveUserByUsername,
    ).toHaveBeenCalledWith('playertwo');
    expect(result).toEqual({
      id: 'user-2',
      username: 'playertwo',
      bio: 'Buying the board.',
      avatarUrl: 'https://pub-example.r2.dev/avatars/user-2/avatar.webp',
      stats,
      createdAt: new Date('2026-05-14T12:00:00.000Z'),
      updatedAt: new Date('2026-05-14T12:15:00.000Z'),
    });
    expect(result).not.toHaveProperty('email');
  });

  it('does not return deleted users in public profile lookup', async () => {
    usersProfileRepository.findActiveUserByUsername.mockResolvedValue(null);

    await expect(service.getByUsername('playerone')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      usersProfileRepository.findActiveUserByUsername,
    ).toHaveBeenCalledWith('playerone');
  });
});

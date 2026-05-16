import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { StorageService } from '../../infra/storage/storage.service';
import type { UsersQueueService } from '../jobs/users-queue.service';
import type { UsersMediaRepository } from '../repositories/users-media.repository';
import type { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersMediaService } from '../services/users-media.service';
import type { UsersRateLimitService } from '../services/users-rate-limit.service';
import type { UsersStatsService } from '../services/users-stats.service';

type UsersProfileRepositoryMock = {
  findActiveUserById: jest.Mock;
};

type UsersMediaRepositoryMock = {
  updateAvatarObjectKey: jest.Mock;
};

type UsersStatsServiceMock = {
  getStats: jest.Mock;
};

type UsersRateLimitServiceMock = {
  enforceUpdateMe: jest.Mock;
};

type StorageServiceMock = {
  createPresignedUploadUrl: jest.Mock;
  getObjectMetadata: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type UsersQueueServiceMock = {
  enqueueDeleteAvatar: jest.Mock;
};

const authUser: AuthUser = {
  id: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const context = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

const stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  averagePlacement: null,
  rating: null,
};

describe('UsersMediaService', () => {
  let service: UsersMediaService;
  let usersProfileRepository: UsersProfileRepositoryMock;
  let usersMediaRepository: UsersMediaRepositoryMock;
  let usersStatsService: UsersStatsServiceMock;
  let usersRateLimitService: UsersRateLimitServiceMock;
  let storageService: StorageServiceMock;
  let configService: ConfigServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let usersQueueService: UsersQueueServiceMock;

  beforeEach(() => {
    usersProfileRepository = {
      findActiveUserById: jest.fn(),
    };

    usersMediaRepository = {
      updateAvatarObjectKey: jest.fn(),
    };

    usersStatsService = {
      getStats: jest.fn().mockResolvedValue(stats),
    };

    usersRateLimitService = {
      enforceUpdateMe: jest.fn().mockResolvedValue(undefined),
    };

    storageService = {
      createPresignedUploadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.example/upload-url'),
      getObjectMetadata: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    usersQueueService = {
      enqueueDeleteAvatar: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersMediaService(
      usersProfileRepository as unknown as UsersProfileRepository,
      usersMediaRepository as unknown as UsersMediaRepository,
      usersStatsService as unknown as UsersStatsService,
      usersRateLimitService as unknown as UsersRateLimitService,
      storageService as unknown as StorageService,
      configService as unknown as ConfigService,
      observabilityService as unknown as ObservabilityService,
      usersQueueService as unknown as UsersQueueService,
    );
  });

  it('creates a short-lived presigned avatar upload url with a backend-owned object key', async () => {
    const result = await service.createAvatarUploadUrl(
      authUser,
      {
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
      },
      context,
    );

    expect(usersRateLimitService.enforceUpdateMe).toHaveBeenCalledWith(
      authUser,
      context,
    );

    expect(result.uploadUrl).toBe('https://r2.example/upload-url');
    expect(result.expiresInSeconds).toBe(600);
    expect(result.objectKey).toMatch(
      new RegExp(`^avatars/${authUser.id}/[0-9a-f-]{36}\\.webp$`),
    );

    expect(storageService.createPresignedUploadUrl).toHaveBeenCalledWith({
      objectKey: result.objectKey,
      contentType: 'image/webp',
      contentLength: 5 * 1024 * 1024,
    });
  });

  it('rejects confirm when the object key does not belong to the authenticated user', async () => {
    await expect(
      service.confirmAvatarUpload(
        authUser,
        {
          objectKey:
            'avatars/other-user/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(usersMediaRepository.updateAvatarObjectKey).not.toHaveBeenCalled();
  });

  it('confirms a real uploaded avatar, updates the profile, and queues old avatar deletion', async () => {
    const createdAt = new Date('2026-05-14T12:00:00.000Z');
    const updatedAt = new Date('2026-05-14T12:15:00.000Z');

    const objectKey = `avatars/${authUser.id}/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp`;
    const oldObjectKey = `avatars/${authUser.id}/old-avatar.webp`;

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
    });

    usersProfileRepository.findActiveUserById.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      bio: null,
      avatarObjectKey: oldObjectKey,
      createdAt,
      updatedAt,
    });

    usersMediaRepository.updateAvatarObjectKey.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      bio: null,
      avatarObjectKey: objectKey,
      createdAt,
      updatedAt,
    });

    const result = await service.confirmAvatarUpload(
      authUser,
      { objectKey },
      context,
    );

    expect(storageService.getObjectMetadata).toHaveBeenCalledWith(objectKey);

    expect(usersMediaRepository.updateAvatarObjectKey).toHaveBeenCalledWith(
      authUser.id,
      objectKey,
    );

    expect(usersQueueService.enqueueDeleteAvatar).toHaveBeenCalledWith({
      userId: authUser.id,
      objectKey: oldObjectKey,
    });

    expect(usersStatsService.getStats).toHaveBeenCalledWith(authUser.id);

    expect(result).toEqual({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      bio: null,
      avatarUrl: `https://pub-example.r2.dev/${objectKey}`,
      stats,
      createdAt,
      updatedAt,
    });
  });
});

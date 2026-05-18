import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { StorageService } from '../../infra/storage/storage.service';
import type { UsersQueueService } from '../jobs/users-queue.service';
import type { UsersMediaRepository } from '../repositories/users-media.repository';
import type { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersMediaService } from '../services/users-media.service';
import { USER_EVENTS } from '../users.constants';

type UsersProfileRepositoryMock = {
  findActiveUserById: jest.Mock;
};

type UsersMediaRepositoryMock = {
  createAvatarUpload: jest.Mock;
  updateAvatarObjectKey: jest.Mock;
};

type StorageServiceMock = {
  createPresignedUploadUrl: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type UsersQueueServiceMock = {
  enqueueVerifyAvatarUpload: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

const authUser: AuthUser = {
  id: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

describe('UsersMediaService', () => {
  let service: UsersMediaService;
  let usersProfileRepository: UsersProfileRepositoryMock;
  let usersMediaRepository: UsersMediaRepositoryMock;
  let storageService: StorageServiceMock;
  let configService: ConfigServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let usersQueueService: UsersQueueServiceMock;
  let databaseService: DatabaseServiceMock;

  beforeEach(() => {
    usersProfileRepository = {
      findActiveUserById: jest.fn().mockResolvedValue({
        id: authUser.id,
        email: authUser.email,
        username: authUser.username,
        bio: null,
        avatarObjectKey: `avatars/${authUser.id}/old-avatar.webp`,
        createdAt: new Date('2026-05-14T12:00:00.000Z'),
        updatedAt: new Date('2026-05-14T12:15:00.000Z'),
      }),
    };

    usersMediaRepository = {
      createAvatarUpload: jest.fn().mockResolvedValue({
        id: 'upload-1',
        userId: authUser.id,
        objectKey: `avatars/${authUser.id}/generated.webp`,
        previousAvatarObjectKey: `avatars/${authUser.id}/old-avatar.webp`,
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 600_000),
      }),
      updateAvatarObjectKey: jest.fn().mockResolvedValue({
        id: authUser.id,
      }),
    };

    storageService = {
      createPresignedUploadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.example/upload-url'),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    usersQueueService = {
      enqueueVerifyAvatarUpload: jest.fn().mockResolvedValue(undefined),
    };

    databaseService = {
      transaction: jest.fn(async (callback) => callback('tx')),
    };

    service = new UsersMediaService(
      usersProfileRepository as unknown as UsersProfileRepository,
      usersMediaRepository as unknown as UsersMediaRepository,
      storageService as unknown as StorageService,
      configService as unknown as ConfigService,
      observabilityService as unknown as ObservabilityService,
      usersQueueService as unknown as UsersQueueService,
      databaseService as unknown as DatabaseService,
    );
  });

  it('creates an avatar upload intent, updates avatar immediately, and queues verification', async () => {
    const result = await service.createAvatarUploadUrl(authUser, {
      contentType: 'image/webp',
      contentLength: 5 * 1024 * 1024,
    });

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);

    expect(usersMediaRepository.createAvatarUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authUser.id,
        objectKey: expect.stringMatching(
          new RegExp(`^avatars/${authUser.id}/[0-9a-f-]{36}\\.webp$`),
        ),
        previousAvatarObjectKey: `avatars/${authUser.id}/old-avatar.webp`,
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
        expiresAt: expect.any(Date),
      }),
      'tx',
    );

    expect(usersMediaRepository.updateAvatarObjectKey).toHaveBeenCalledWith(
      authUser.id,
      result.objectKey,
      'tx',
    );

    expect(storageService.createPresignedUploadUrl).toHaveBeenCalledWith({
      objectKey: result.objectKey,
      contentType: 'image/webp',
      contentLength: 5 * 1024 * 1024,
    });

    expect(usersQueueService.enqueueVerifyAvatarUpload).toHaveBeenCalledWith({
      uploadId: 'upload-1',
      userId: authUser.id,
      objectKey: result.objectKey,
    });

    expect(observabilityService.recordSecurityEvent).toHaveBeenCalledWith(
      USER_EVENTS.avatarUploadUrlCreated,
      expect.objectContaining({
        userId: authUser.id,
        username: authUser.username,
        uploadId: 'upload-1',
        objectKey: result.objectKey,
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
      }),
    );

    expect(result).toEqual({
      uploadId: 'upload-1',
      uploadUrl: 'https://r2.example/upload-url',
      objectKey: expect.stringMatching(
        new RegExp(`^avatars/${authUser.id}/[0-9a-f-]{36}\\.webp$`),
      ),
      avatarUrl: `https://pub-example.r2.dev/${result.objectKey}`,
      expiresInSeconds: 600,
    });
  });

  it('does not create an upload intent for a deleted or missing user', async () => {
    usersProfileRepository.findActiveUserById.mockResolvedValue(null);

    await expect(
      service.createAvatarUploadUrl(authUser, {
        contentType: 'image/webp',
        contentLength: 1024,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
    expect(storageService.createPresignedUploadUrl).not.toHaveBeenCalled();
    expect(usersQueueService.enqueueVerifyAvatarUpload).not.toHaveBeenCalled();
  });
});

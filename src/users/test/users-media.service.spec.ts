import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { StorageService } from '../../infra/storage/storage.service';
import type { UsersQueueService } from '../jobs/users-queue.service';
import type { UsersMediaRepository } from '../repositories/users-media.repository';
import type { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersMediaService } from '../services/users-media.service';
import type { UsersStatsService } from '../services/users-stats.service';

type UsersProfileRepositoryMock = {
  findActiveUserById: jest.Mock;
};

type UsersMediaRepositoryMock = {
  createAvatarUpload: jest.Mock;
  findPendingAvatarUpload: jest.Mock;
  confirmAvatarUpload: jest.Mock;
  markAvatarUploadExpired: jest.Mock;
  updateAvatarObjectKey: jest.Mock;
};

type UsersStatsServiceMock = {
  getStats: jest.Mock;
};

type StorageServiceMock = {
  createPresignedUploadUrl: jest.Mock;
  getObjectMetadata: jest.Mock;
  getObjectBytes: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type UsersQueueServiceMock = {
  enqueueDeleteAvatar: jest.Mock;
  enqueueAvatarUploadCleanup: jest.Mock;
};

const authUser: AuthUser = {
  id: '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  averagePlacement: null,
  rating: null,
};

const webpHeader = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe('UsersMediaService', () => {
  let service: UsersMediaService;
  let usersProfileRepository: UsersProfileRepositoryMock;
  let usersMediaRepository: UsersMediaRepositoryMock;
  let usersStatsService: UsersStatsServiceMock;
  let storageService: StorageServiceMock;
  let configService: ConfigServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let usersQueueService: UsersQueueServiceMock;

  beforeEach(() => {
    usersProfileRepository = {
      findActiveUserById: jest.fn(),
    };

    usersMediaRepository = {
      createAvatarUpload: jest.fn().mockResolvedValue({
        id: 'upload-1',
        userId: authUser.id,
        objectKey: `avatars/${authUser.id}/generated.webp`,
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
        status: 'pending',
        expiresAt: new Date(Date.now() + 600_000),
      }),
      findPendingAvatarUpload: jest.fn(),
      confirmAvatarUpload: jest.fn(),
      markAvatarUploadExpired: jest.fn(),
      updateAvatarObjectKey: jest.fn(),
    };

    usersStatsService = {
      getStats: jest.fn().mockResolvedValue(stats),
    };

    storageService = {
      createPresignedUploadUrl: jest
        .fn()
        .mockResolvedValue('https://r2.example/upload-url'),
      getObjectMetadata: jest.fn(),
      getObjectBytes: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    usersQueueService = {
      enqueueDeleteAvatar: jest.fn().mockResolvedValue(undefined),
      enqueueAvatarUploadCleanup: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersMediaService(
      usersProfileRepository as unknown as UsersProfileRepository,
      usersMediaRepository as unknown as UsersMediaRepository,
      usersStatsService as unknown as UsersStatsService,
      storageService as unknown as StorageService,
      configService as unknown as ConfigService,
      observabilityService as unknown as ObservabilityService,
      usersQueueService as unknown as UsersQueueService,
    );
  });

  it('creates a short-lived presigned avatar upload url with a backend-owned object key and cleanup job', async () => {
    const result = await service.createAvatarUploadUrl(
      authUser,
      {
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
      },
    );

    expect(usersMediaRepository.createAvatarUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authUser.id,
        contentType: 'image/webp',
        contentLength: 5 * 1024 * 1024,
      }),
    );

    expect(storageService.createPresignedUploadUrl).toHaveBeenCalledWith({
      objectKey: result.objectKey,
      contentType: 'image/webp',
      contentLength: 5 * 1024 * 1024,
    });

    expect(usersQueueService.enqueueAvatarUploadCleanup).toHaveBeenCalledWith({
      uploadId: 'upload-1',
      userId: authUser.id,
      objectKey: result.objectKey,
    });

    expect(result).toEqual({
      uploadId: 'upload-1',
      uploadUrl: 'https://r2.example/upload-url',
      objectKey: expect.stringMatching(
        new RegExp(`^avatars/${authUser.id}/[0-9a-f-]{36}\\.webp$`),
      ),
      expiresInSeconds: 600,
    });
  });

  it('rejects confirm when the upload intent does not match the authenticated user and object key', async () => {
    const objectKey = `avatars/${authUser.id}/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp`;

    usersMediaRepository.findPendingAvatarUpload.mockResolvedValue({
      id: 'upload-1',
      userId: 'other-user',
      objectKey,
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.confirmAvatarUpload(
        authUser,
        {
          uploadId: 'upload-1',
          objectKey,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.getObjectMetadata).not.toHaveBeenCalled();
    expect(storageService.getObjectBytes).not.toHaveBeenCalled();
    expect(usersMediaRepository.updateAvatarObjectKey).not.toHaveBeenCalled();
  });

  it('rejects confirm when the uploaded object metadata does not match the upload intent', async () => {
    const objectKey = `avatars/${authUser.id}/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp`;

    usersMediaRepository.findPendingAvatarUpload.mockResolvedValue({
      id: 'upload-1',
      userId: authUser.id,
      objectKey,
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 2 * 1024 * 1024,
    });

    await expect(
      service.confirmAvatarUpload(
        authUser,
        {
          uploadId: 'upload-1',
          objectKey,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.getObjectBytes).not.toHaveBeenCalled();
    expect(usersMediaRepository.updateAvatarObjectKey).not.toHaveBeenCalled();
  });

  it('rejects confirm when uploaded bytes do not match the declared image type', async () => {
    const objectKey = `avatars/${authUser.id}/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp`;

    usersMediaRepository.findPendingAvatarUpload.mockResolvedValue({
      id: 'upload-1',
      userId: authUser.id,
      objectKey,
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
    });

    storageService.getObjectBytes.mockResolvedValue(
      Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]),
    );

    await expect(
      service.confirmAvatarUpload(
        authUser,
        {
          uploadId: 'upload-1',
          objectKey,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storageService.getObjectBytes).toHaveBeenCalledWith(
      objectKey,
      'bytes=0-15',
    );
    expect(usersMediaRepository.updateAvatarObjectKey).not.toHaveBeenCalled();
    expect(usersMediaRepository.confirmAvatarUpload).not.toHaveBeenCalled();
  });

  it('confirms a valid uploaded avatar, updates the profile, marks upload confirmed, and queues old avatar deletion', async () => {
    const createdAt = new Date('2026-05-14T12:00:00.000Z');
    const updatedAt = new Date('2026-05-14T12:15:00.000Z');

    const objectKey = `avatars/${authUser.id}/8d9a4e5a-90db-4c1d-95d8-9df8fc8f5b9e.webp`;
    const oldObjectKey = `avatars/${authUser.id}/old-avatar.webp`;

    usersMediaRepository.findPendingAvatarUpload.mockResolvedValue({
      id: 'upload-1',
      userId: authUser.id,
      objectKey,
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 1024 * 1024,
    });

    storageService.getObjectBytes.mockResolvedValue(webpHeader);

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

    usersMediaRepository.confirmAvatarUpload.mockResolvedValue({
      id: 'upload-1',
      userId: authUser.id,
      objectKey,
      status: 'confirmed',
    });

    const result = await service.confirmAvatarUpload(
      authUser,
      {
        uploadId: 'upload-1',
        objectKey,
      },
    );

    expect(storageService.getObjectMetadata).toHaveBeenCalledWith(objectKey);
    expect(storageService.getObjectBytes).toHaveBeenCalledWith(
      objectKey,
      'bytes=0-15',
    );

    expect(usersMediaRepository.updateAvatarObjectKey).toHaveBeenCalledWith(
      authUser.id,
      objectKey,
    );

    expect(usersMediaRepository.confirmAvatarUpload).toHaveBeenCalledWith(
      'upload-1',
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

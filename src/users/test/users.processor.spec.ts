import type { Job } from 'bullmq';
import type { CacheService } from '../../infra/cache/cache.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import { USER_JOBS } from '../../infra/queue/queue.constants';
import type { StorageService } from '../../infra/storage/storage.service';
import type { MailQueueService } from '../../mail/jobs/mail-queue.service';
import { UsersProcessor } from '../jobs/users.processor';
import type { VerifyAvatarUploadJob } from '../jobs/users-jobs.types';
import type { UsersMediaRepository } from '../repositories/users-media.repository';

type MailQueueServiceMock = {
  enqueueAccountDeletedEmail: jest.Mock;
};

type CacheServiceMock = {
  withLock: jest.Mock;
};

type StorageServiceMock = {
  getObjectMetadata: jest.Mock;
  getObjectBytes: jest.Mock;
  deleteObject: jest.Mock;
};

type UsersMediaRepositoryMock = {
  findAvatarUploadById: jest.Mock;
  confirmAvatarUpload: jest.Mock;
  restoreAvatarObjectKey: jest.Mock;
  markAvatarUploadExpired: jest.Mock;
  markAvatarUploadCleanedUp: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

const userId = '7c6e0f4e-7f8d-4c18-a0cf-906f4c8b2b91';
const uploadId = 'upload-1';
const objectKey = `avatars/${userId}/avatar.webp`;
const previousAvatarObjectKey = `avatars/${userId}/old-avatar.webp`;

const webpHeader = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const createVerifyAvatarUploadJob = (): Job<VerifyAvatarUploadJob> =>
  ({
    id: 'job-1',
    name: USER_JOBS.verifyAvatarUpload,
    data: {
      uploadId,
      userId,
      objectKey,
    },
  }) as Job<VerifyAvatarUploadJob>;

const createPendingUpload = () => ({
  id: uploadId,
  userId,
  objectKey,
  previousAvatarObjectKey,
  contentType: 'image/webp',
  contentLength: 1024,
  status: 'pending' as const,
  expiresAt: new Date('2026-05-14T12:10:00.000Z'),
  confirmedAt: null,
  cleanedUpAt: null,
  expiredAt: null,
});

describe('UsersProcessor', () => {
  let processor: UsersProcessor;
  let mailQueueService: MailQueueServiceMock;
  let cacheService: CacheServiceMock;
  let storageService: StorageServiceMock;
  let usersMediaRepository: UsersMediaRepositoryMock;
  let observabilityService: ObservabilityServiceMock;

  beforeEach(() => {
    mailQueueService = {
      enqueueAccountDeletedEmail: jest.fn(),
    };

    cacheService = {
      withLock: jest.fn(({ callback }: { callback: () => Promise<unknown> }) =>
        callback(),
      ),
    };

    storageService = {
      getObjectMetadata: jest.fn(),
      getObjectBytes: jest.fn(),
      deleteObject: jest.fn(),
    };

    usersMediaRepository = {
      findAvatarUploadById: jest.fn(),
      confirmAvatarUpload: jest.fn(),
      restoreAvatarObjectKey: jest.fn(),
      markAvatarUploadExpired: jest.fn(),
      markAvatarUploadCleanedUp: jest.fn(),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    processor = new UsersProcessor(
      mailQueueService as unknown as MailQueueService,
      cacheService as unknown as CacheService,
      storageService as unknown as StorageService,
      usersMediaRepository as unknown as UsersMediaRepository,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('confirms a valid uploaded avatar and deletes the previous avatar', async () => {
    usersMediaRepository.findAvatarUploadById.mockResolvedValue(
      createPendingUpload(),
    );
    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 1024,
    });
    storageService.getObjectBytes.mockResolvedValue(webpHeader);
    usersMediaRepository.confirmAvatarUpload.mockResolvedValue({
      id: uploadId,
      userId,
      objectKey,
      status: 'confirmed' as const,
    });

    await processor.process(createVerifyAvatarUploadJob());

    expect(cacheService.withLock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `lock:users:verify-avatar-upload:${uploadId}`,
      }),
    );

    expect(storageService.getObjectMetadata).toHaveBeenCalledWith(objectKey);
    expect(storageService.getObjectBytes).toHaveBeenCalledWith(
      objectKey,
      'bytes=0-15',
    );

    expect(usersMediaRepository.confirmAvatarUpload).toHaveBeenCalledWith(
      uploadId,
    );

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      previousAvatarObjectKey,
    );

    expect(usersMediaRepository.restoreAvatarObjectKey).not.toHaveBeenCalled();
    expect(usersMediaRepository.markAvatarUploadExpired).not.toHaveBeenCalled();
    expect(
      usersMediaRepository.markAvatarUploadCleanedUp,
    ).not.toHaveBeenCalled();
  });

  it('expires the upload and restores the previous avatar when no object was uploaded', async () => {
    usersMediaRepository.findAvatarUploadById.mockResolvedValue(
      createPendingUpload(),
    );
    storageService.getObjectMetadata.mockResolvedValue(null);

    await processor.process(createVerifyAvatarUploadJob());

    expect(usersMediaRepository.restoreAvatarObjectKey).toHaveBeenCalledWith(
      userId,
      objectKey,
      previousAvatarObjectKey,
    );

    expect(usersMediaRepository.markAvatarUploadExpired).toHaveBeenCalledWith(
      uploadId,
    );

    expect(usersMediaRepository.confirmAvatarUpload).not.toHaveBeenCalled();
    expect(storageService.deleteObject).not.toHaveBeenCalled();
    expect(storageService.getObjectBytes).not.toHaveBeenCalled();
  });

  it('cleans up invalid uploaded avatar content and restores the previous avatar', async () => {
    usersMediaRepository.findAvatarUploadById.mockResolvedValue(
      createPendingUpload(),
    );
    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/webp',
      contentLength: 1024,
    });
    storageService.getObjectBytes.mockResolvedValue(
      Uint8Array.from([0x68, 0x65, 0x6c, 0x6c, 0x6f]),
    );

    await processor.process(createVerifyAvatarUploadJob());

    expect(storageService.deleteObject).toHaveBeenCalledWith(objectKey);

    expect(usersMediaRepository.restoreAvatarObjectKey).toHaveBeenCalledWith(
      userId,
      objectKey,
      previousAvatarObjectKey,
    );

    expect(usersMediaRepository.markAvatarUploadCleanedUp).toHaveBeenCalledWith(
      uploadId,
    );

    expect(usersMediaRepository.confirmAvatarUpload).not.toHaveBeenCalled();
    expect(usersMediaRepository.markAvatarUploadExpired).not.toHaveBeenCalled();
  });
});

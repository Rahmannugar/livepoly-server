import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { StorageService } from '../../infra/storage/storage.service';
import {
  ConfirmAvatarUploadDto,
  CreateAvatarUploadUrlDto,
} from '../dto/avatar.dto';
import { UsersQueueService } from '../jobs/users-queue.service';
import { UsersMediaRepository } from '../repositories/users-media.repository';
import { UsersProfileRepository } from '../repositories/users-profile.repository';
import { USER_AVATAR } from '../users.constants';
import type { UserAvatarContentType } from '../users.constants';
import {
  UsersRateLimitService,
  UsersRequestContext,
} from './users-rate-limit.service';
import { UsersStatsService } from './users-stats.service';

@Injectable()
export class UsersMediaService {
  constructor(
    private readonly usersProfileRepository: UsersProfileRepository,
    private readonly usersMediaRepository: UsersMediaRepository,
    private readonly usersStatsService: UsersStatsService,
    private readonly usersRateLimitService: UsersRateLimitService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly observabilityService: ObservabilityService,
    private readonly usersQueueService: UsersQueueService,
  ) {}

  async createAvatarUploadUrl(
    authUser: AuthUser,
    dto: CreateAvatarUploadUrlDto,
    context: UsersRequestContext,
  ) {
    await this.usersRateLimitService.enforceUpdateMe(authUser, context);

    const extension = this.avatarExtensionForContentType(dto.contentType);
    const objectKey = `avatars/${authUser.id}/${randomUUID()}.${extension}`;
    const expiresAt = new Date(
      Date.now() + USER_AVATAR.uploadExpiresInSeconds * 1000,
    );

    const upload = await this.usersMediaRepository.createAvatarUpload({
      userId: authUser.id,
      objectKey,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
      expiresAt,
    });

    const uploadUrl = await this.storageService.createPresignedUploadUrl({
      objectKey,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });

    await this.usersQueueService.enqueueAvatarUploadCleanup({
      uploadId: upload.id,
      userId: authUser.id,
      objectKey,
    });

    this.recordSecurityEvent('UserAvatarUploadUrlCreated', {
      userId: authUser.id,
      username: authUser.username,
      uploadId: upload.id,
      objectKey,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });

    return {
      uploadId: upload.id,
      uploadUrl,
      objectKey,
      expiresInSeconds: USER_AVATAR.uploadExpiresInSeconds,
    };
  }

  async confirmAvatarUpload(
    authUser: AuthUser,
    dto: ConfirmAvatarUploadDto,
    context: UsersRequestContext,
  ) {
    await this.usersRateLimitService.enforceUpdateMe(authUser, context);

    const upload = await this.usersMediaRepository.findPendingAvatarUpload(
      dto.uploadId,
    );

    if (!upload) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: dto.uploadId,
        reason: 'upload_not_found',
      });

      throw new BadRequestException('Avatar upload was not found');
    }

    if (upload.userId !== authUser.id || upload.objectKey !== dto.objectKey) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: dto.uploadId,
        reason: 'upload_mismatch',
      });

      throw new BadRequestException('Invalid avatar upload');
    }

    if (upload.expiresAt.getTime() < Date.now()) {
      await this.usersMediaRepository.markAvatarUploadExpired(upload.id);

      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'upload_expired',
      });

      throw new BadRequestException('Avatar upload has expired');
    }

    if (!this.isValidAvatarObjectKey(authUser.id, dto.objectKey)) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'invalid_object_key',
      });

      throw new BadRequestException('Invalid avatar object key');
    }

    const metadata = await this.storageService.getObjectMetadata(dto.objectKey);

    if (!metadata) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'object_not_found',
      });

      throw new BadRequestException('Avatar upload was not found');
    }

    if (
      metadata.contentType !== upload.contentType ||
      !this.isAllowedAvatarContentType(metadata.contentType)
    ) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'invalid_content_type',
      });

      throw new BadRequestException('Avatar file type is not allowed');
    }

    if (metadata.contentLength !== upload.contentLength) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'invalid_content_length',
      });

      throw new BadRequestException('Avatar file size does not match upload');
    }

    if (
      !this.contentTypeMatchesObjectKey(dto.objectKey, metadata.contentType)
    ) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'content_type_key_mismatch',
      });

      throw new BadRequestException(
        'Avatar file type does not match object key',
      );
    }

    const currentUser = await this.usersProfileRepository.findActiveUserById(
      authUser.id,
    );

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.usersMediaRepository.updateAvatarObjectKey(
      authUser.id,
      dto.objectKey,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const confirmedUpload = await this.usersMediaRepository.confirmAvatarUpload(
      upload.id,
    );

    if (!confirmedUpload) {
      this.recordSecurityEvent('UserAvatarConfirmFailed', {
        userId: authUser.id,
        username: authUser.username,
        uploadId: upload.id,
        reason: 'upload_already_processed',
      });

      throw new BadRequestException('Avatar upload was already processed');
    }

    if (
      currentUser.avatarObjectKey &&
      currentUser.avatarObjectKey !== dto.objectKey
    ) {
      await this.usersQueueService.enqueueDeleteAvatar({
        userId: authUser.id,
        objectKey: currentUser.avatarObjectKey,
      });
    }

    const stats = await this.usersStatsService.getStats(user.id);

    this.recordSecurityEvent('UserAvatarUpdated', {
      userId: user.id,
      username: user.username,
      uploadId: upload.id,
      objectKey: dto.objectKey,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatarUrl: this.resolveAvatarUrl(user.avatarObjectKey),
      stats,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private isValidAvatarObjectKey(userId: string, objectKey: string) {
    const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return new RegExp(
      `^avatars/${escapedUserId}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
    ).test(objectKey);
  }

  private isAllowedAvatarContentType(
    contentType: string | null,
  ): contentType is UserAvatarContentType {
    return USER_AVATAR.allowedContentTypes.includes(
      contentType as UserAvatarContentType,
    );
  }

  private contentTypeMatchesObjectKey(
    objectKey: string,
    contentType: string | null,
  ) {
    if (contentType === 'image/jpeg') return objectKey.endsWith('.jpg');
    if (contentType === 'image/png') return objectKey.endsWith('.png');
    if (contentType === 'image/webp') return objectKey.endsWith('.webp');

    return false;
  }

  private avatarExtensionForContentType(contentType: UserAvatarContentType) {
    if (contentType === 'image/jpeg') return 'jpg';
    if (contentType === 'image/png') return 'png';

    return 'webp';
  }

  private resolveAvatarUrl(avatarObjectKey: string | null) {
    if (!avatarObjectKey) return null;

    const baseUrl = this.configService.getOrThrow<string>('R2_PUBLIC_BASE_URL');
    return `${baseUrl.replace(/\/$/, '')}/${avatarObjectKey}`;
  }

  private recordSecurityEvent(
    eventName: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
  ) {
    this.observabilityService.recordSecurityEvent(eventName, attributes);
  }
}

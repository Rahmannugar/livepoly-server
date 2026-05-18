import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { StorageService } from '../../infra/storage/storage.service';
import { CreateAvatarUploadUrlDto } from '../dto/avatar.dto';
import { UsersQueueService } from '../jobs/users-queue.service';
import { UsersMediaRepository } from '../repositories/users-media.repository';
import { UsersProfileRepository } from '../repositories/users-profile.repository';
import { USER_AVATAR } from '../users.constants';
import type { UserAvatarContentType } from '../users.constants';

@Injectable()
export class UsersMediaService {
  constructor(
    private readonly usersProfileRepository: UsersProfileRepository,
    private readonly usersMediaRepository: UsersMediaRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly observabilityService: ObservabilityService,
    private readonly usersQueueService: UsersQueueService,
    private readonly databaseService: DatabaseService,
  ) {}

  async createAvatarUploadUrl(
    authUser: AuthUser,
    dto: CreateAvatarUploadUrlDto,
  ) {
    const currentUser = await this.usersProfileRepository.findActiveUserById(
      authUser.id,
    );

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    const extension = this.avatarExtensionForContentType(dto.contentType);
    const objectKey = `avatars/${authUser.id}/${randomUUID()}.${extension}`;
    const expiresAt = new Date(
      Date.now() + USER_AVATAR.uploadExpiresInSeconds * 1000,
    );

    const upload = await this.databaseService.transaction(async (tx) => {
      const createdUpload = await this.usersMediaRepository.createAvatarUpload(
        {
          userId: authUser.id,
          objectKey,
          previousAvatarObjectKey: currentUser.avatarObjectKey,
          contentType: dto.contentType,
          contentLength: dto.contentLength,
          expiresAt,
        },
        tx,
      );

      const user = await this.usersMediaRepository.updateAvatarObjectKey(
        authUser.id,
        objectKey,
        tx,
      );

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return createdUpload;
    });

    const uploadUrl = await this.storageService.createPresignedUploadUrl({
      objectKey,
      contentType: dto.contentType,
      contentLength: dto.contentLength,
    });

    await this.usersQueueService.enqueueVerifyAvatarUpload({
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
      avatarUrl: this.resolveAvatarUrl(objectKey),
      expiresInSeconds: USER_AVATAR.uploadExpiresInSeconds,
    };
  }

  private avatarExtensionForContentType(contentType: UserAvatarContentType) {
    if (contentType === 'image/jpeg') return 'jpg';
    if (contentType === 'image/png') return 'png';

    return 'webp';
  }

  private resolveAvatarUrl(avatarObjectKey: string) {
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

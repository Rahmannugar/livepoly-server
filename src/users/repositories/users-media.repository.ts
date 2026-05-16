import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../../infra/database/database.service';
import { USER_AVATAR_UPLOAD_STATUS } from '../users.constants';
import type { UserAvatarContentType } from '../users.constants';
import { users, userAvatarUploads } from '../../infra/database/schema';

type CreateAvatarUploadInput = {
  userId: string;
  objectKey: string;
  contentType: UserAvatarContentType;
  contentLength: number;
  expiresAt: Date;
};

@Injectable()
export class UsersMediaRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async createAvatarUpload(
    input: CreateAvatarUploadInput,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [upload] = await db
      .insert(userAvatarUploads)
      .values({
        userId: input.userId,
        objectKey: input.objectKey,
        contentType: input.contentType,
        contentLength: input.contentLength,
        status: USER_AVATAR_UPLOAD_STATUS.pending,
        expiresAt: input.expiresAt,
      })
      .returning({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        contentType: userAvatarUploads.contentType,
        contentLength: userAvatarUploads.contentLength,
        status: userAvatarUploads.status,
        expiresAt: userAvatarUploads.expiresAt,
      });

    return upload;
  }

  async findAvatarUploadById(uploadId: string) {
    const [upload] = await this.databaseService.db
      .select({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        contentType: userAvatarUploads.contentType,
        contentLength: userAvatarUploads.contentLength,
        status: userAvatarUploads.status,
        expiresAt: userAvatarUploads.expiresAt,
        confirmedAt: userAvatarUploads.confirmedAt,
        cleanedUpAt: userAvatarUploads.cleanedUpAt,
        expiredAt: userAvatarUploads.expiredAt,
      })
      .from(userAvatarUploads)
      .where(eq(userAvatarUploads.id, uploadId))
      .limit(1);

    return upload ?? null;
  }

  async findPendingAvatarUpload(uploadId: string) {
    const [upload] = await this.databaseService.db
      .select({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        contentType: userAvatarUploads.contentType,
        contentLength: userAvatarUploads.contentLength,
        status: userAvatarUploads.status,
        expiresAt: userAvatarUploads.expiresAt,
      })
      .from(userAvatarUploads)
      .where(
        and(
          eq(userAvatarUploads.id, uploadId),
          eq(userAvatarUploads.status, USER_AVATAR_UPLOAD_STATUS.pending),
        ),
      )
      .limit(1);

    return upload ?? null;
  }

  async confirmAvatarUpload(uploadId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [upload] = await db
      .update(userAvatarUploads)
      .set({
        status: USER_AVATAR_UPLOAD_STATUS.confirmed,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userAvatarUploads.id, uploadId),
          eq(userAvatarUploads.status, USER_AVATAR_UPLOAD_STATUS.pending),
        ),
      )
      .returning({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        status: userAvatarUploads.status,
      });

    return upload ?? null;
  }

  async markAvatarUploadCleanedUp(
    uploadId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [upload] = await db
      .update(userAvatarUploads)
      .set({
        status: USER_AVATAR_UPLOAD_STATUS.cleanedUp,
        cleanedUpAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userAvatarUploads.id, uploadId),
          eq(userAvatarUploads.status, USER_AVATAR_UPLOAD_STATUS.pending),
        ),
      )
      .returning({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        status: userAvatarUploads.status,
      });

    return upload ?? null;
  }

  async markAvatarUploadExpired(uploadId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [upload] = await db
      .update(userAvatarUploads)
      .set({
        status: USER_AVATAR_UPLOAD_STATUS.expired,
        expiredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userAvatarUploads.id, uploadId),
          eq(userAvatarUploads.status, USER_AVATAR_UPLOAD_STATUS.pending),
        ),
      )
      .returning({
        id: userAvatarUploads.id,
        userId: userAvatarUploads.userId,
        objectKey: userAvatarUploads.objectKey,
        status: userAvatarUploads.status,
      });

    return upload ?? null;
  }

  async updateAvatarObjectKey(
    userId: string,
    avatarObjectKey: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [user] = await db
      .update(users)
      .set({
        avatarObjectKey,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        bio: users.bio,
        avatarObjectKey: users.avatarObjectKey,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user ?? null;
  }
}

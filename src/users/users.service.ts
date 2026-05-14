import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../infra/database/database.service';
import { ObservabilityService } from '../infra/observability/observability.service';
import { SessionCacheService } from '../session/session-cache.service';
import { AuthRepository } from '../auth/auth.repository';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';
import {
  UsersRateLimitService,
  UsersRequestContext,
} from './users-rate-limit.service';
import { UsersQueueService } from './users-queue.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly sessionCacheService: SessionCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly observabilityService: ObservabilityService,
    private readonly usersRateLimitService: UsersRateLimitService,
    private readonly usersQueueService: UsersQueueService,
  ) {}

  async getMe(authUser: AuthUser, context: UsersRequestContext) {
    await this.usersRateLimitService.enforceGetMe(authUser, context);

    const user = await this.usersRepository.findActiveUserById(authUser.id);

    if (!user) {
      this.recordSecurityEvent('UserProfileViewFailed', {
        userId: authUser.id,
        username: authUser.username,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    this.recordSecurityEvent('UserProfileViewed', {
      userId: user.id,
      username: user.username,
    });

    return this.toPrivateProfile(user);
  }

  async updateMe(
    authUser: AuthUser,
    dto: UpdateUserDto,
    context: UsersRequestContext,
  ) {
    await this.usersRateLimitService.enforceUpdateMe(authUser, context);

    const username = dto.username?.trim().toLowerCase();
    const bio = dto.bio === undefined ? undefined : dto.bio.trim() || null;

    this.recordSecurityEvent('UserProfileUpdateRequested', {
      userId: authUser.id,
      username: authUser.username,
    });

    if (username === undefined && bio === undefined) {
      this.recordSecurityEvent('UserProfileUpdateFailed', {
        userId: authUser.id,
        username: authUser.username,
        reason: 'empty_update',
      });

      throw new BadRequestException('No profile updates provided');
    }

    if (username && username !== authUser.username) {
      const existingUser =
        await this.usersRepository.findUserByUsername(username);

      if (existingUser) {
        this.recordSecurityEvent('UserProfileUpdateFailed', {
          userId: authUser.id,
          username: authUser.username,
          reason: 'username_taken',
        });

        throw new ConflictException('Username already exists');
      }
    }

    let user: Awaited<ReturnType<UsersRepository['updateUser']>> | null = null;

    try {
      user = await this.usersRepository.updateUser(authUser.id, {
        ...(username ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
      });
    } catch (error) {
      if (this.isUsernameUniqueViolation(error)) {
        this.recordSecurityEvent('UserProfileUpdateFailed', {
          userId: authUser.id,
          username: authUser.username,
          reason: 'username_taken_race',
        });

        throw new ConflictException('Username already exists');
      }

      throw error;
    }

    if (!user) {
      this.recordSecurityEvent('UserProfileUpdateFailed', {
        userId: authUser.id,
        username: authUser.username,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    this.recordSecurityEvent('UserProfileUpdated', {
      userId: user.id,
      username: user.username,
    });

    return this.toPrivateProfile(user);
  }

  async deleteMe(
    authUser: AuthUser,
    context: UsersRequestContext,
  ): Promise<void> {
    await this.usersRateLimitService.enforceDeleteMe(authUser, context);

    this.recordSecurityEvent('UserDeleteRequested', {
      userId: authUser.id,
      username: authUser.username,
    });

    const { user, revokedSessions } = await this.databaseService.transaction(
      async (tx) => {
        const user = await this.usersRepository.deleteUser(authUser.id, tx);

        if (!user) {
          return { user: null, revokedSessions: [] };
        }

        const revokedSessions = await this.authRepository.revokeUserSessions(
          authUser.id,
          tx,
        );

        return { user, revokedSessions };
      },
    );

    if (!user) {
      this.recordSecurityEvent('UserDeleteFailed', {
        userId: authUser.id,
        username: authUser.username,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    await Promise.all(
      revokedSessions.map((session) =>
        this.sessionCacheService.deleteSession(session.refreshTokenHash),
      ),
    );
    await this.usersQueueService.enqueueDeletedUserCleanup({
      userId: user.id,
      email: user.email,
      username: user.username,
      avatarObjectKey: user.avatarObjectKey,
      deletedAt: new Date().toISOString(),
    });

    this.recordSecurityEvent('UserDeleted', {
      userId: authUser.id,
      username: authUser.username,
    });
  }

  async getByUsername(username: string, context: UsersRequestContext) {
    await this.usersRateLimitService.enforceGetPublicProfile(context);
    const normalizedUsername = username.trim().toLowerCase();
    const user =
      await this.usersRepository.findActiveUserByUsername(normalizedUsername);

    if (!user) {
      this.recordSecurityEvent('PublicProfileViewFailed', {
        targetUsername: normalizedUsername,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    this.recordSecurityEvent('PublicProfileViewed', {
      targetUserId: user.id,
      targetUsername: user.username,
    });

    return this.toPublicProfile(user);
  }

  private toPrivateProfile(user: {
    id: string;
    email: string;
    username: string;
    bio: string | null;
    avatarObjectKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatarUrl: this.resolveAvatarUrl(user.avatarObjectKey),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toPublicProfile(user: {
    id: string;
    username: string;
    bio: string | null;
    avatarObjectKey: string | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      bio: user.bio,
      avatarUrl: this.resolveAvatarUrl(user.avatarObjectKey),
      createdAt: user.createdAt,
    };
  }

  private resolveAvatarUrl(avatarObjectKey: string | null) {
    if (!avatarObjectKey) {
      return null;
    }

    const baseUrl = this.configService.getOrThrow<string>('R2_PUBLIC_BASE_URL');
    return `${baseUrl.replace(/\/$/, '')}/${avatarObjectKey}`;
  }

  private isUsernameUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'constraint_name' in error &&
      error.code === '23505' &&
      error.constraint_name === 'users_username_unique_idx'
    );
  }

  private recordSecurityEvent(
    eventName: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
  ) {
    this.observabilityService.recordSecurityEvent(eventName, attributes);
  }
}

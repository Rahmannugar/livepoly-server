import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../../auth/auth.repository';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { SessionCacheService } from '../../session/session-cache.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersQueueService } from '../jobs/users-queue.service';
import { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersStatsService } from './users-stats.service';

@Injectable()
export class UsersProfileService {
  constructor(
    private readonly usersProfileRepository: UsersProfileRepository,
    private readonly usersStatsService: UsersStatsService,
    private readonly authRepository: AuthRepository,
    private readonly sessionCacheService: SessionCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly observabilityService: ObservabilityService,
    private readonly usersQueueService: UsersQueueService,
  ) {}

  async getByUsername(username: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const user =
      await this.usersProfileRepository.findActiveUserByUsername(
        normalizedUsername,
      );

    if (!user) {
      this.recordSecurityEvent('PublicProfileViewFailed', {
        targetUsername: normalizedUsername,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    const stats = await this.usersStatsService.getStats(user.id);

    this.recordSecurityEvent('PublicProfileViewed', {
      targetUserId: user.id,
      targetUsername: user.username,
    });

    return this.profile(user, stats);
  }

  async getMe(authUser: AuthUser) {
    const user = await this.usersProfileRepository.findActiveUserById(
      authUser.id,
    );

    if (!user) {
      this.recordSecurityEvent('UserProfileViewFailed', {
        userId: authUser.id,
        username: authUser.username,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    const stats = await this.usersStatsService.getStats(user.id);

    this.recordSecurityEvent('UserProfileViewed', {
      userId: user.id,
      username: user.username,
    });

    return this.profile(user, stats);
  }

  async updateMe(authUser: AuthUser, dto: UpdateUserDto) {
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
        await this.usersProfileRepository.findUserByUsername(username);

      if (existingUser) {
        this.recordSecurityEvent('UserProfileUpdateFailed', {
          userId: authUser.id,
          username: authUser.username,
          reason: 'username_taken',
        });

        throw new ConflictException('Username already exists');
      }
    }

    try {
      const user = await this.usersProfileRepository.updateUser(authUser.id, {
        ...(username ? { username } : {}),
        ...(bio !== undefined ? { bio } : {}),
      });

      if (!user) {
        this.recordSecurityEvent('UserProfileUpdateFailed', {
          userId: authUser.id,
          username: authUser.username,
          reason: 'user_not_found',
        });

        throw new NotFoundException('User not found');
      }

      const stats = await this.usersStatsService.getStats(user.id);

      this.recordSecurityEvent('UserProfileUpdated', {
        userId: user.id,
        username: user.username,
      });

      return this.profile(user, stats);
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
  }

  async deleteMe(authUser: AuthUser): Promise<void> {
    this.recordSecurityEvent('UserDeleteRequested', {
      userId: authUser.id,
      username: authUser.username,
    });

    const { user, revokedSessions } = await this.databaseService.transaction(
      async (tx) => {
        const user = await this.usersProfileRepository.deleteUser(
          authUser.id,
          tx,
        );

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

  private profile(
    user: {
      id: string;
      email: string;
      username: string;
      bio: string | null;
      avatarObjectKey: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    stats: Awaited<ReturnType<UsersStatsService['getStats']>>,
  ) {
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

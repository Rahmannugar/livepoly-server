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
import { USER_EVENTS, USER_SEARCH } from '../users.constants';
import { UsersQueueService } from '../jobs/users-queue.service';
import { UsersProfileRepository } from '../repositories/users-profile.repository';
import { UsersStatsService } from './users-stats.service';
import { SearchUsersDto } from '../dto/search-users.dto';
import { Buffer } from 'buffer';
import { CacheService } from '../../infra/cache/cache.service';
import type {
  UserSearchCursor,
  UserSearchResponse,
  UserSearchRow,
} from '../users.types';

@Injectable()
export class UsersProfileService {
  constructor(
    private readonly usersProfileRepository: UsersProfileRepository,
    private readonly usersStatsService: UsersStatsService,
    private readonly authRepository: AuthRepository,
    private readonly sessionCacheService: SessionCacheService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly usersQueueService: UsersQueueService,
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async getByUsername(username: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const user =
      await this.usersProfileRepository.findActiveUserByUsername(
        normalizedUsername,
      );

    if (!user) {
      this.recordSecurityEvent(USER_EVENTS.publicProfileViewFailed, {
        targetUsername: normalizedUsername,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    const stats = await this.usersStatsService.getStats(user.id);

    this.recordSecurityEvent(USER_EVENTS.publicProfileViewed, {
      targetUserId: user.id,
      targetUsername: user.username,
    });

    return this.publicProfile(user, stats);
  }

  async searchUsers(dto: SearchUsersDto): Promise<UserSearchResponse> {
    const query = dto.query.trim().toLowerCase();

    if (query.length < USER_SEARCH.minQueryLength) {
      return { items: [], nextCursor: null };
    }

    const limit = Math.min(
      dto.limit ?? USER_SEARCH.defaultLimit,
      USER_SEARCH.maxLimit,
    );
    const cursor = this.decodeUserSearchCursor(dto.cursor);

    if (!cursor) {
      const cacheVersion = await this.getUserSearchCacheVersion();

      return this.cacheService.getOrSet({
        key: `users:search:v${cacheVersion}:${query}:first:${limit}`,
        ttlSeconds: USER_SEARCH.firstPageTtlSeconds,
        ttlJitterRatio: USER_SEARCH.ttlJitterRatio,
        factory: () => this.loadUserSearch({ query, limit }),
      });
    }

    return this.loadUserSearch({ query, limit, cursor });
  }

  async getMe(authUser: AuthUser) {
    const user = await this.usersProfileRepository.findActiveUserById(
      authUser.id,
    );

    if (!user) {
      this.recordSecurityEvent(USER_EVENTS.profileViewFailed, {
        userId: authUser.id,
        username: authUser.username,
        reason: 'user_not_found',
      });

      throw new NotFoundException('User not found');
    }

    const stats = await this.usersStatsService.getStats(user.id);

    this.recordSecurityEvent(USER_EVENTS.profileViewed, {
      userId: user.id,
      username: user.username,
    });

    return this.profile(user, stats);
  }

  async updateMe(authUser: AuthUser, dto: UpdateUserDto) {
    const username = dto.username?.trim().toLowerCase();
    const bio = dto.bio === undefined ? undefined : dto.bio.trim() || null;

    this.recordSecurityEvent(USER_EVENTS.profileUpdateRequested, {
      userId: authUser.id,
      username: authUser.username,
    });

    if (username === undefined && bio === undefined) {
      this.recordSecurityEvent(USER_EVENTS.profileUpdateFailed, {
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
        this.recordSecurityEvent(USER_EVENTS.profileUpdateFailed, {
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
        this.recordSecurityEvent(USER_EVENTS.profileUpdateFailed, {
          userId: authUser.id,
          username: authUser.username,
          reason: 'user_not_found',
        });

        throw new NotFoundException('User not found');
      }

      const stats = await this.usersStatsService.getStats(user.id);

      this.recordSecurityEvent(USER_EVENTS.profileUpdated, {
        userId: user.id,
        username: user.username,
      });

      return this.profile(user, stats);
    } catch (error) {
      if (this.isUsernameUniqueViolation(error)) {
        this.recordSecurityEvent(USER_EVENTS.profileUpdateFailed, {
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
    this.recordSecurityEvent(USER_EVENTS.deleteRequested, {
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
      this.recordSecurityEvent(USER_EVENTS.deleteFailed, {
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

    this.recordSecurityEvent(USER_EVENTS.deleted, {
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

  private publicProfile(
    user: {
      id: string;
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

  private async loadUserSearch(input: {
    query: string;
    limit: number;
    cursor?: UserSearchCursor;
  }): Promise<UserSearchResponse> {
    const rows =
      await this.usersProfileRepository.searchUsersByUsernamePrefix(input);
    const items = rows.slice(0, input.limit);

    return {
      items: items.map((row) => ({
        id: row.id,
        username: row.username,
        avatarUrl: this.resolveAvatarUrl(row.avatarObjectKey),
      })),
      nextCursor:
        rows.length > input.limit
          ? this.encodeUserSearchCursor(items[items.length - 1])
          : null,
    };
  }

  private async getUserSearchCacheVersion(): Promise<number> {
    const value = await this.cacheService
      .getClient()
      .get('users:search:version');
    return value ? Number(value) : 1;
  }

  private encodeUserSearchCursor(row: UserSearchRow): string {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        username: row.username,
        userId: row.id,
      }),
    ).toString('base64url');
  }

  private decodeUserSearchCursor(
    cursor?: string,
  ): UserSearchCursor | undefined {
    if (!cursor) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: number;
        username?: string;
        userId?: string;
      };

      if (
        decoded.v !== 1 ||
        !decoded.username ||
        !decoded.userId
      ) {
        throw new Error('Invalid cursor payload');
      }

      return {
        username: decoded.username,
        userId: decoded.userId,
      };
    } catch {
      throw new BadRequestException('Invalid user search cursor');
    }
  }
}

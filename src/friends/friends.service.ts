import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { DatabaseService } from '../infra/database/database.service';
import { ObservabilityService } from '../infra/observability/observability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OutboxQueueService } from '../outbox/jobs/outbox-queue.service';
import { Buffer } from 'buffer';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FRIEND_EVENTS, FRIEND_LIST } from './friends.constants';
import { FriendsRepository } from './friends.repository';
import { CacheService } from '../infra/cache/cache.service';
import type {
  FriendListCursor,
  FriendSummaryRow,
  PaginatedFriendsResponse,
} from './friends.types';
import { ListFriendsDto } from './dto/list-friends.dto';
import { ListFriendRequestsDto } from './dto/list-friend-requests.dto';

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly observabilityService: ObservabilityService,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
    private readonly outboxQueueService: OutboxQueueService,
  ) {}

  async sendRequest(authUser: AuthUser, dto: CreateFriendRequestDto) {
    const username = dto.username.trim().toLowerCase();

    if (username === authUser.username) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }

    const addressee =
      await this.friendsRepository.findActiveUserByUsername(username);

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.friendsRepository.findFriendshipBetween(
      authUser.id,
      addressee.id,
    );

    if (existing) {
      throw new ConflictException('Friendship already exists');
    }

    const requester = await this.friendsRepository.findActiveUserById(
      authUser.id,
    );

    if (!requester) {
      throw new NotFoundException('User not found');
    }

    try {
      const result = await this.databaseService.transaction(async (tx) => {
        const created = await this.friendsRepository.createFriendRequest(
          authUser.id,
          addressee.id,
          tx,
        );

        const notificationResult =
          await this.notificationsService.createFriendRequestNotification(
            {
              userId: addressee.id,
              requesterId: requester.id,
              requesterUsername: requester.username,
              requesterAvatarObjectKey: requester.avatarObjectKey,
              friendshipId: created.id,
            },
            tx,
          );

        return {
          friendship: created,
          outboxEventId: notificationResult.outboxEventId,
        };
      });

      await this.invalidateFriendListCache([authUser.id, addressee.id]);

      await this.outboxQueueService.enqueuePublishEvent(result.outboxEventId);

      this.recordSecurityEvent(FRIEND_EVENTS.requestSent, {
        userId: authUser.id,
        username: authUser.username,
        targetUserId: addressee.id,
        targetUsername: addressee.username,
      });

      return result.friendship;
    } catch (error) {
      if (this.friendsRepository.isUniquePairViolation(error)) {
        throw new ConflictException('Friendship already exists');
      }

      throw error;
    }
  }

  async acceptRequest(authUser: AuthUser, friendshipId: string) {
    const accepter = await this.friendsRepository.findActiveUserById(
      authUser.id,
    );

    if (!accepter) {
      throw new NotFoundException('User not found');
    }

    const result = await this.databaseService.transaction(async (tx) => {
      const accepted = await this.friendsRepository.acceptFriendRequest(
        friendshipId,
        authUser.id,
        tx,
      );

      if (!accepted) {
        return null;
      }

      const notificationResult =
        await this.notificationsService.createFriendAcceptedNotification(
          {
            userId: accepted.requesterId,
            friendId: accepter.id,
            friendUsername: accepter.username,
            friendAvatarObjectKey: accepter.avatarObjectKey,
            friendshipId: accepted.id,
          },
          tx,
        );

      return {
        friendship: accepted,
        outboxEventId: notificationResult.outboxEventId,
      };
    });

    if (!result) {
      throw new NotFoundException('Friend request not found');
    }

    await this.invalidateFriendListCache([
      result.friendship.requesterId,
      result.friendship.addresseeId,
    ]);

    await this.outboxQueueService.enqueuePublishEvent(result.outboxEventId);

    this.recordSecurityEvent(FRIEND_EVENTS.requestAccepted, {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });

    return result.friendship;
  }

  async rejectRequest(authUser: AuthUser, friendshipId: string) {
    const friendship = await this.friendsRepository.rejectFriendRequest(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    await this.invalidateFriendListCache([
      friendship.requesterId,
      friendship.addresseeId,
    ]);

    this.recordSecurityEvent(FRIEND_EVENTS.requestRejected, {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async cancelRequest(authUser: AuthUser, friendshipId: string) {
    const friendship = await this.friendsRepository.cancelFriendRequest(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    await this.invalidateFriendListCache([
      friendship.requesterId,
      friendship.addresseeId,
    ]);

    this.recordSecurityEvent(FRIEND_EVENTS.requestCanceled, {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async removeFriend(authUser: AuthUser, friendshipId: string) {
    const friendship = await this.friendsRepository.removeFriend(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.invalidateFriendListCache([
      friendship.requesterId,
      friendship.addresseeId,
    ]);

    this.recordSecurityEvent(FRIEND_EVENTS.removed, {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async listFriends(
    authUser: AuthUser,
    dto: ListFriendsDto,
  ): Promise<PaginatedFriendsResponse<FriendSummaryRow>> {
    const limit = Math.min(
      dto.limit ?? FRIEND_LIST.defaultLimit,
      FRIEND_LIST.maxLimit,
    );
    const cursor = this.decodeFriendCursor(dto.cursor);

    if (!cursor) {
      const version = await this.getFriendListCacheVersion(authUser.id);

      return this.cacheService.getOrSet({
        key: `friends:${authUser.id}:list:v${version}:first:${limit}`,
        ttlSeconds: FRIEND_LIST.firstPageTtlSeconds,
        ttlJitterRatio: FRIEND_LIST.ttlJitterRatio,
        factory: () =>
          this.loadFriends({
            userId: authUser.id,
            limit,
          }),
      });
    }

    return this.loadFriends({
      userId: authUser.id,
      limit,
      cursor,
    });
  }

  async listRequests(authUser: AuthUser, dto: ListFriendRequestsDto) {
    const limit = Math.min(
      dto.limit ?? FRIEND_LIST.defaultLimit,
      FRIEND_LIST.maxLimit,
    );

    const incomingCursor = this.decodeFriendCursor(dto.incomingCursor);
    const outgoingCursor = this.decodeFriendCursor(dto.outgoingCursor);

    if (!incomingCursor && !outgoingCursor) {
      const version = await this.getFriendListCacheVersion(authUser.id);

      return this.cacheService.getOrSet({
        key: `friends:${authUser.id}:requests:v${version}:first:${limit}`,
        ttlSeconds: FRIEND_LIST.firstPageTtlSeconds,
        ttlJitterRatio: FRIEND_LIST.ttlJitterRatio,
        factory: () =>
          this.loadFriendRequests({
            userId: authUser.id,
            limit,
          }),
      });
    }

    return this.loadFriendRequests({
      userId: authUser.id,
      limit,
      incomingCursor,
      outgoingCursor,
    });
  }

  private async loadFriends(input: {
    userId: string;
    limit: number;
    cursor?: FriendListCursor;
  }): Promise<PaginatedFriendsResponse<FriendSummaryRow>> {
    const rows = await this.friendsRepository.listFriends(input);
    const items = rows.slice(0, input.limit);

    return {
      items,
      nextCursor:
        rows.length > input.limit
          ? this.encodeFriendCursor(items[items.length - 1])
          : null,
    };
  }

  private async loadFriendRequests(input: {
    userId: string;
    limit: number;
    incomingCursor?: FriendListCursor;
    outgoingCursor?: FriendListCursor;
  }) {
    const [incomingRows, outgoingRows] = await Promise.all([
      this.friendsRepository.listIncomingFriendRequests({
        userId: input.userId,
        limit: input.limit,
        cursor: input.incomingCursor,
      }),
      this.friendsRepository.listOutgoingFriendRequests({
        userId: input.userId,
        limit: input.limit,
        cursor: input.outgoingCursor,
      }),
    ]);

    const incoming = incomingRows.slice(0, input.limit);
    const outgoing = outgoingRows.slice(0, input.limit);

    return {
      incoming: {
        items: incoming,
        nextCursor:
          incomingRows.length > input.limit
            ? this.encodeFriendCursor(incoming[incoming.length - 1])
            : null,
      },
      outgoing: {
        items: outgoing,
        nextCursor:
          outgoingRows.length > input.limit
            ? this.encodeFriendCursor(outgoing[outgoing.length - 1])
            : null,
      },
    };
  }

  private async invalidateFriendListCache(userIds: string[]): Promise<void> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    const redis = this.cacheService.getClient();

    await Promise.all(
      uniqueUserIds.map((userId) => redis.incr(`friends:${userId}:version`)),
    );
  }

  private async getFriendListCacheVersion(userId: string): Promise<number> {
    const value = await this.cacheService
      .getClient()
      .get(`friends:${userId}:version`);

    return value ? Number(value) : 1;
  }

  private encodeFriendCursor(row: {
    friendshipId: string;
    createdAt: Date;
  }): string {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        friendshipId: row.friendshipId,
        createdAt: row.createdAt.toISOString(),
      }),
    ).toString('base64url');
  }

  private decodeFriendCursor(cursor?: string): FriendListCursor | undefined {
    if (!cursor) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: number;
        friendshipId?: string;
        createdAt?: string;
      };

      if (decoded.v !== 1 || !decoded.friendshipId || !decoded.createdAt) {
        throw new Error('Invalid cursor payload');
      }

      const createdAt = new Date(decoded.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid cursor date');
      }

      return {
        friendshipId: decoded.friendshipId,
        createdAt,
      };
    } catch {
      throw new BadRequestException('Invalid friends cursor');
    }
  }

  private recordSecurityEvent(
    eventName: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
  ) {
    this.observabilityService.recordSecurityEvent(eventName, attributes);
  }
}

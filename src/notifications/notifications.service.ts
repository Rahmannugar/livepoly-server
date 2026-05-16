import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/types/auth-user.type';
import { ObservabilityService } from '../infra/observability/observability.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  NotificationsRateLimitService,
  NotificationsRequestContext,
} from './notifications-rate-limit.service';
import { NotificationsRepository } from './notifications.repository';
import { Buffer } from 'buffer';

const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 100;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsRateLimitService: NotificationsRateLimitService,
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  async createFriendRequestNotification(input: {
    userId: string;
    requesterId: string;
    requesterUsername: string;
    requesterAvatarObjectKey?: string | null;
    friendshipId: string;
  }) {
    return this.notificationsRepository.createNotification({
      userId: input.userId,
      type: 'friend_request',
      title: 'New friend request',
      body: `${input.requesterUsername} sent you a friend request`,
      data: {
        friendshipId: input.friendshipId,
        requesterId: input.requesterId,
        requesterUsername: input.requesterUsername,
        requesterAvatarObjectKey: input.requesterAvatarObjectKey ?? null,
        requesterAvatarUrl: this.resolveAvatarUrl(
          input.requesterAvatarObjectKey,
        ),
        link: `/users/${input.requesterUsername}`,
      },
    });
  }

  async createFriendAcceptedNotification(input: {
    userId: string;
    friendId: string;
    friendUsername: string;
    friendAvatarObjectKey?: string | null;
    friendshipId: string;
  }) {
    return this.notificationsRepository.createNotification({
      userId: input.userId,
      type: 'friend_accepted',
      title: 'Friend request accepted',
      body: `${input.friendUsername} accepted your friend request`,
      data: {
        friendshipId: input.friendshipId,
        friendId: input.friendId,
        friendUsername: input.friendUsername,
        friendAvatarObjectKey: input.friendAvatarObjectKey ?? null,
        friendAvatarUrl: this.resolveAvatarUrl(input.friendAvatarObjectKey),
        link: `/users/${input.friendUsername}`,
      },
    });
  }

  async list(
    authUser: AuthUser,
    dto: ListNotificationsDto,
    context: NotificationsRequestContext,
  ) {
    await this.notificationsRateLimitService.enforceRead(authUser, context);

    const limit = Math.min(
      dto.limit ?? DEFAULT_NOTIFICATION_LIMIT,
      MAX_NOTIFICATION_LIMIT,
    );
    const cursor = this.decodeCursor(dto.cursor);

    const rows = await this.notificationsRepository.listNotifications({
      userId: authUser.id,
      limit,
      cursor,
    });

    const items = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? this.encodeCursor(items[items.length - 1]) : null;

    return {
      items,
      nextCursor,
    };
  }

  async markAsRead(
    authUser: AuthUser,
    notificationId: string,
    context: NotificationsRequestContext,
  ) {
    await this.notificationsRateLimitService.enforceMutation(authUser, context);

    const notification = await this.notificationsRepository.markAsRead(
      notificationId,
      authUser.id,
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    this.recordSecurityEvent('NotificationMarkedRead', {
      userId: authUser.id,
      username: authUser.username,
      notificationId,
    });

    return notification;
  }

  async markAllAsRead(
    authUser: AuthUser,
    context: NotificationsRequestContext,
  ) {
    await this.notificationsRateLimitService.enforceMutation(authUser, context);

    await this.notificationsRepository.markAllAsRead(authUser.id);

    this.recordSecurityEvent('NotificationsMarkedRead', {
      userId: authUser.id,
      username: authUser.username,
    });

    return { message: 'Notifications marked as read' };
  }

  private encodeCursor(notification: { createdAt: Date; id: string }) {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        createdAt: notification.createdAt.toISOString(),
        id: notification.id,
      }),
    ).toString('base64url');
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return undefined;

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { v?: number; createdAt?: string; id?: string };

      if (decoded.v !== 1 || !decoded.createdAt || !decoded.id) {
        throw new Error('Invalid cursor payload');
      }

      const createdAt = new Date(decoded.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid cursor date');
      }

      return {
        createdAt,
        id: decoded.id,
      };
    } catch {
      throw new BadRequestException('Invalid notification cursor');
    }
  }

  private resolveAvatarUrl(avatarObjectKey: string | null | undefined) {
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

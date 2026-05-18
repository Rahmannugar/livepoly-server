import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { OutboxService } from '../../outbox/outbox.service';
import { OUTBOX_TOPICS } from '../../outbox/outbox.types';
import type { NotificationsRepository } from '../notifications.repository';
import { NotificationsService } from '../notifications.service';

type NotificationsRepositoryMock = {
  createNotification: jest.Mock;
  listNotifications: jest.Mock;
  markAsRead: jest.Mock;
  markAllAsRead: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type OutboxServiceMock = {
  createOrGet: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepository: NotificationsRepositoryMock;
  let observabilityService: ObservabilityServiceMock;
  let configService: ConfigServiceMock;
  let outboxService: OutboxServiceMock;

  const tx = { tx: true } as unknown as DatabaseExecutor;

  beforeEach(() => {
    notificationsRepository = {
      createNotification: jest.fn(),
      listNotifications: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    outboxService = {
      createOrGet: jest.fn().mockResolvedValue({
        id: 'outbox-event-1',
      }),
    };

    service = new NotificationsService(
      notificationsRepository as unknown as NotificationsRepository,
      observabilityService as unknown as ObservabilityService,
      configService as unknown as ConfigService,
      outboxService as unknown as OutboxService,
    );
  });

  it('creates friend request notification and outbox event with the same executor', async () => {
    const createdAt = new Date('2026-05-14T12:00:00.000Z');

    notificationsRepository.createNotification.mockResolvedValue({
      id: 'notification-1',
      userId: 'user-2',
      type: 'friend_request' as const,
      title: 'New friend request',
      body: 'playerone sent you a friend request',
      data: {},
      read: false,
      createdAt,
      readAt: null,
    });

    const result = await service.createFriendRequestNotification(
      {
        userId: 'user-2',
        requesterId: authUser.id,
        requesterUsername: authUser.username,
        requesterAvatarObjectKey: 'avatars/user-1/avatar.webp',
        friendshipId: 'friendship-1',
      },
      tx,
    );

    expect(result).toEqual({
      notification: {
        id: 'notification-1',
        userId: 'user-2',
        type: 'friend_request' as const,
        title: 'New friend request',
        body: 'playerone sent you a friend request',
        data: {},
        read: false,
        createdAt,
        readAt: null,
      },
      outboxEventId: 'outbox-event-1',
    });

    expect(notificationsRepository.createNotification).toHaveBeenCalledWith(
      {
        userId: 'user-2',
        type: 'friend_request' as const,
        title: 'New friend request',
        body: 'playerone sent you a friend request',
        data: {
          friendshipId: 'friendship-1',
          requesterId: authUser.id,
          requesterUsername: authUser.username,
          requesterAvatarObjectKey: 'avatars/user-1/avatar.webp',
          requesterAvatarUrl:
            'https://pub-example.r2.dev/avatars/user-1/avatar.webp',
          link: '/users/playerone',
        },
      },
      tx,
    );

    expect(outboxService.createOrGet).toHaveBeenCalledWith(
      {
        key: 'notification.created:notification-1',
        topic: OUTBOX_TOPICS.notificationCreated,
        payload: {
          notificationId: 'notification-1',
          userId: 'user-2',
          type: 'friend_request' as const,
          createdAt: createdAt.toISOString(),
        },
      },
      tx,
    );
  });
});

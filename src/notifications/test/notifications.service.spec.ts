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
  findLeaderboardNotification: jest.Mock;
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
  role: 'player',
  status: 'active',
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
      findLeaderboardNotification: jest.fn().mockResolvedValue(null),
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

  it('creates leaderboard notification and outbox event once per leaderboard key', async () => {
    const createdAt = new Date('2026-05-30T12:00:00.000Z');

    notificationsRepository.createNotification.mockResolvedValue({
      id: 'notification-2',
      userId: 'user-1',
      type: 'leaderboard' as const,
      title: 'You made the weekly leaderboard',
      body: 'You placed #1 with a 560 rating',
      data: {},
      read: false,
      createdAt,
      readAt: null,
    });

    const result = await service.createLeaderboardNotification({
      userId: 'user-1',
      period: 'weekly',
      leaderboardKey: 'weekly:2026-W22',
      rank: 1,
      rating: 560,
      gamesPlayed: 4,
      wins: 2,
    });

    expect(result.outboxEventId).toBe('outbox-event-1');
    expect(notificationsRepository.findLeaderboardNotification).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        leaderboardKey: 'weekly:2026-W22',
      },
    );
    expect(notificationsRepository.createNotification).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        type: 'leaderboard',
        title: 'You made the weekly leaderboard',
        body: 'You placed #1 with a 560 rating',
        data: {
          period: 'weekly',
          leaderboardKey: 'weekly:2026-W22',
          rank: 1,
          rating: 560,
          gamesPlayed: 4,
          wins: 2,
          link: '/leaderboard?period=weekly',
        },
      },
      undefined,
    );
  });

  it('returns existing leaderboard notification without creating another outbox event', async () => {
    const existingNotification = {
      id: 'notification-2',
      userId: 'user-1',
      type: 'leaderboard' as const,
      title: 'You made the weekly leaderboard',
      body: 'You placed #1 with a 560 rating',
      data: {},
      read: false,
      createdAt: new Date('2026-05-30T12:00:00.000Z'),
      readAt: null,
    };
    notificationsRepository.findLeaderboardNotification.mockResolvedValue(
      existingNotification,
    );

    await expect(
      service.createLeaderboardNotification({
        userId: 'user-1',
        period: 'weekly',
        leaderboardKey: 'weekly:2026-W22',
        rank: 1,
        rating: 560,
        gamesPlayed: 4,
        wins: 2,
      }),
    ).resolves.toEqual({
      notification: existingNotification,
      outboxEventId: null,
    });

    expect(notificationsRepository.createNotification).not.toHaveBeenCalled();
    expect(outboxService.createOrGet).not.toHaveBeenCalled();
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

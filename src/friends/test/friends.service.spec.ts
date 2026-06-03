import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { CacheService } from '../../infra/cache/cache.service';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import type { FriendsRepository } from '../friends.repository';
import { FriendsService } from '../friends.service';

type FriendsRepositoryMock = {
  findActiveUserById: jest.Mock;
  findActiveUserByUsername: jest.Mock;
  findFriendshipBetween: jest.Mock;
  createFriendRequest: jest.Mock;
  acceptFriendRequest: jest.Mock;
  rejectFriendRequest: jest.Mock;
  cancelFriendRequest: jest.Mock;
  removeFriend: jest.Mock;
  listFriends: jest.Mock;
  listFriendRequests: jest.Mock;
  isUniquePairViolation: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

type NotificationsServiceMock = {
  createFriendRequestNotification: jest.Mock;
  createFriendAcceptedNotification: jest.Mock;
};

type OutboxQueueServiceMock = {
  enqueuePublishEvent: jest.Mock;
};

type CacheServiceMock = {
  getClient: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

describe('FriendsService', () => {
  let service: FriendsService;
  let friendsRepository: FriendsRepositoryMock;
  let observabilityService: ObservabilityServiceMock;
  let databaseService: DatabaseServiceMock;
  let notificationsService: NotificationsServiceMock;
  let cacheService: CacheServiceMock;
  let outboxQueueService: OutboxQueueServiceMock;

  const tx = { tx: true };

  beforeEach(() => {
    friendsRepository = {
      findActiveUserById: jest.fn(),
      findActiveUserByUsername: jest.fn(),
      findFriendshipBetween: jest.fn(),
      createFriendRequest: jest.fn(),
      acceptFriendRequest: jest.fn(),
      rejectFriendRequest: jest.fn(),
      cancelFriendRequest: jest.fn(),
      removeFriend: jest.fn(),
      listFriends: jest.fn(),
      listFriendRequests: jest.fn(),
      isUniquePairViolation: jest.fn().mockReturnValue(false),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    databaseService = {
      transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
    };

    notificationsService = {
      createFriendRequestNotification: jest.fn(),
      createFriendAcceptedNotification: jest.fn(),
    };

    cacheService = {
      getClient: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
      }),
    };

    outboxQueueService = {
      enqueuePublishEvent: jest.fn().mockResolvedValue(undefined),
    };

    service = new FriendsService(
      friendsRepository as unknown as FriendsRepository,
      observabilityService as unknown as ObservabilityService,
      databaseService as unknown as DatabaseService,
      notificationsService as unknown as NotificationsService,
      cacheService as unknown as CacheService,
      outboxQueueService as unknown as OutboxQueueService,
    );
  });

  it('rejects sending a friend request to yourself', async () => {
    await expect(
      service.sendRequest(authUser, { username: ' PlayerOne ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(friendsRepository.findActiveUserByUsername).not.toHaveBeenCalled();
    expect(friendsRepository.createFriendRequest).not.toHaveBeenCalled();
    expect(
      notificationsService.createFriendRequestNotification,
    ).not.toHaveBeenCalled();
    expect(outboxQueueService.enqueuePublishEvent).not.toHaveBeenCalled();
  });

  it('rejects duplicate existing friendship', async () => {
    friendsRepository.findActiveUserByUsername.mockResolvedValue({
      id: 'user-2',
      email: 'friend@example.com',
      username: 'friendone',
      avatarObjectKey: null,
    });

    friendsRepository.findFriendshipBetween.mockResolvedValue({
      id: 'friendship-1',
      requesterId: authUser.id,
      addresseeId: 'user-2',
      status: 'pending' as const,
    });

    await expect(
      service.sendRequest(authUser, { username: 'friendone' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(friendsRepository.createFriendRequest).not.toHaveBeenCalled();
    expect(
      notificationsService.createFriendRequestNotification,
    ).not.toHaveBeenCalled();
    expect(outboxQueueService.enqueuePublishEvent).not.toHaveBeenCalled();
  });

  it('creates a notification and enqueues publish when sending a friend request', async () => {
    friendsRepository.findActiveUserByUsername.mockResolvedValue({
      id: 'user-2',
      email: 'friend@example.com',
      username: 'friendone',
      avatarObjectKey: null,
    });

    friendsRepository.findFriendshipBetween.mockResolvedValue(null);

    friendsRepository.findActiveUserById.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      avatarObjectKey: 'avatars/user-1/avatar.webp',
    });

    friendsRepository.createFriendRequest.mockResolvedValue({
      id: 'friendship-1',
      requesterId: authUser.id,
      addresseeId: 'user-2',
      status: 'pending' as const,
      createdAt: new Date('2026-05-14T12:00:00.000Z'),
      updatedAt: new Date('2026-05-14T12:00:00.000Z'),
    });

    notificationsService.createFriendRequestNotification.mockResolvedValue({
      notification: {
        id: 'notification-1',
      },
      outboxEventId: 'outbox-event-1',
    });

    await service.sendRequest(authUser, { username: 'friendone' });

    expect(friendsRepository.createFriendRequest).toHaveBeenCalledWith(
      authUser.id,
      'user-2',
      tx,
    );

    expect(
      notificationsService.createFriendRequestNotification,
    ).toHaveBeenCalledWith(
      {
        userId: 'user-2',
        requesterId: authUser.id,
        requesterUsername: authUser.username,
        requesterAvatarObjectKey: 'avatars/user-1/avatar.webp',
        friendshipId: 'friendship-1',
      },
      tx,
    );

    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-event-1',
    );
  });

  it('creates a notification and enqueues publish when accepting a friend request', async () => {
    friendsRepository.findActiveUserById.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      avatarObjectKey: 'avatars/user-1/avatar.webp',
    });

    friendsRepository.acceptFriendRequest.mockResolvedValue({
      id: 'friendship-1',
      requesterId: 'user-2',
      addresseeId: authUser.id,
      status: 'accepted' as const,
      createdAt: new Date('2026-05-14T12:00:00.000Z'),
      updatedAt: new Date('2026-05-14T12:15:00.000Z'),
    });

    notificationsService.createFriendAcceptedNotification.mockResolvedValue({
      notification: {
        id: 'notification-2',
      },
      outboxEventId: 'outbox-event-2',
    });

    await service.acceptRequest(authUser, 'friendship-1');

    expect(friendsRepository.acceptFriendRequest).toHaveBeenCalledWith(
      'friendship-1',
      authUser.id,
      tx,
    );

    expect(
      notificationsService.createFriendAcceptedNotification,
    ).toHaveBeenCalledWith(
      {
        userId: 'user-2',
        friendId: authUser.id,
        friendUsername: authUser.username,
        friendAvatarObjectKey: 'avatars/user-1/avatar.webp',
        friendshipId: 'friendship-1',
      },
      tx,
    );

    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-event-2',
    );
  });

  it('uses separate ownership paths for rejecting and canceling friend requests', async () => {
    friendsRepository.rejectFriendRequest.mockResolvedValue({
      id: 'friendship-1',
      requesterId: 'user-2',
      addresseeId: authUser.id,
      status: 'pending' as const,
    });

    friendsRepository.cancelFriendRequest.mockResolvedValue({
      id: 'friendship-2',
      requesterId: authUser.id,
      addresseeId: 'user-2',
      status: 'pending' as const,
    });

    await service.rejectRequest(authUser, 'friendship-1');
    await service.cancelRequest(authUser, 'friendship-2');

    expect(friendsRepository.rejectFriendRequest).toHaveBeenCalledWith(
      'friendship-1',
      authUser.id,
    );

    expect(friendsRepository.cancelFriendRequest).toHaveBeenCalledWith(
      'friendship-2',
      authUser.id,
    );
  });
});

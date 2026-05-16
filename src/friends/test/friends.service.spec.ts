import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { FriendsRateLimitService } from '../friends-rate-limit.service';
import type { FriendsRepository } from '../friends.repository';
import { FriendsService } from '../friends.service';

type FriendsRepositoryMock = {
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

type FriendsRateLimitServiceMock = {
  enforceFriendMutation: jest.Mock;
  enforceFriendRead: jest.Mock;
};

type ObservabilityServiceMock = {
  recordSecurityEvent: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const context = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

describe('FriendsService', () => {
  let service: FriendsService;
  let friendsRepository: FriendsRepositoryMock;
  let friendsRateLimitService: FriendsRateLimitServiceMock;
  let observabilityService: ObservabilityServiceMock;

  beforeEach(() => {
    friendsRepository = {
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

    friendsRateLimitService = {
      enforceFriendMutation: jest.fn().mockResolvedValue(undefined),
      enforceFriendRead: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordSecurityEvent: jest.fn(),
    };

    service = new FriendsService(
      friendsRepository as unknown as FriendsRepository,
      friendsRateLimitService as unknown as FriendsRateLimitService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('rejects sending a friend request to yourself', async () => {
    await expect(
      service.sendRequest(authUser, { username: ' PlayerOne ' }, context),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(friendsRepository.findActiveUserByUsername).not.toHaveBeenCalled();
    expect(friendsRepository.createFriendRequest).not.toHaveBeenCalled();
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
      status: 'pending',
    });

    await expect(
      service.sendRequest(authUser, { username: 'friendone' }, context),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(friendsRepository.createFriendRequest).not.toHaveBeenCalled();
  });

  it('uses separate ownership paths for rejecting and canceling friend requests', async () => {
    friendsRepository.rejectFriendRequest.mockResolvedValue({
      id: 'friendship-1',
      requesterId: 'user-2',
      addresseeId: authUser.id,
      status: 'pending',
    });

    friendsRepository.cancelFriendRequest.mockResolvedValue({
      id: 'friendship-2',
      requesterId: authUser.id,
      addresseeId: 'user-2',
      status: 'pending',
    });

    await service.rejectRequest(authUser, 'friendship-1', context);
    await service.cancelRequest(authUser, 'friendship-2', context);

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

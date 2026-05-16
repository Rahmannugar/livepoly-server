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
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import {
  FriendsRateLimitService,
  FriendsRequestContext,
} from './friends-rate-limit.service';
import { FriendsRepository } from './friends.repository';

@Injectable()
export class FriendsService {
  constructor(
    private readonly friendsRepository: FriendsRepository,
    private readonly friendsRateLimitService: FriendsRateLimitService,
    private readonly observabilityService: ObservabilityService,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxQueueService: OutboxQueueService,
  ) {}

  async sendRequest(
    authUser: AuthUser,
    dto: CreateFriendRequestDto,
    context: FriendsRequestContext,
  ) {
    await this.friendsRateLimitService.enforceFriendMutation(authUser, context);

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

      await this.outboxQueueService.enqueuePublishEvent(result.outboxEventId);

      this.recordSecurityEvent('FriendRequestSent', {
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

  async acceptRequest(
    authUser: AuthUser,
    friendshipId: string,
    context: FriendsRequestContext,
  ) {
    await this.friendsRateLimitService.enforceFriendMutation(authUser, context);

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

    await this.outboxQueueService.enqueuePublishEvent(result.outboxEventId);

    this.recordSecurityEvent('FriendRequestAccepted', {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });

    return result.friendship;
  }

  async rejectRequest(
    authUser: AuthUser,
    friendshipId: string,
    context: FriendsRequestContext,
  ) {
    await this.friendsRateLimitService.enforceFriendMutation(authUser, context);

    const friendship = await this.friendsRepository.rejectFriendRequest(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    this.recordSecurityEvent('FriendRequestRejected', {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async cancelRequest(
    authUser: AuthUser,
    friendshipId: string,
    context: FriendsRequestContext,
  ) {
    await this.friendsRateLimitService.enforceFriendMutation(authUser, context);

    const friendship = await this.friendsRepository.cancelFriendRequest(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    this.recordSecurityEvent('FriendRequestCanceled', {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async removeFriend(
    authUser: AuthUser,
    friendshipId: string,
    context: FriendsRequestContext,
  ) {
    await this.friendsRateLimitService.enforceFriendMutation(authUser, context);

    const friendship = await this.friendsRepository.removeFriend(
      friendshipId,
      authUser.id,
    );

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    this.recordSecurityEvent('FriendRemoved', {
      userId: authUser.id,
      username: authUser.username,
      friendshipId,
    });
  }

  async listFriends(authUser: AuthUser, context: FriendsRequestContext) {
    await this.friendsRateLimitService.enforceFriendRead(authUser, context);

    return this.friendsRepository.listFriends(authUser.id);
  }

  async listRequests(authUser: AuthUser, context: FriendsRequestContext) {
    await this.friendsRateLimitService.enforceFriendRead(authUser, context);

    const requests = await this.friendsRepository.listFriendRequests(
      authUser.id,
    );

    return {
      incoming: requests.filter(
        (request) => request.addresseeId === authUser.id,
      ),
      outgoing: requests.filter(
        (request) => request.requesterId === authUser.id,
      ),
    };
  }

  private recordSecurityEvent(
    eventName: string,
    attributes: Record<string, string | number | boolean | null | undefined>,
  ) {
    this.observabilityService.recordSecurityEvent(eventName, attributes);
  }
}

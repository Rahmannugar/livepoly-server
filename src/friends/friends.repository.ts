import { Injectable } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../infra/database/database.service';
import { friendships, users } from '../infra/database/schema';

const requester = alias(users, 'requester');
const addressee = alias(users, 'addressee');
const friend = alias(users, 'friend');

@Injectable()
export class FriendsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async findActiveUserByUsername(username: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
      })
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async findFriendshipBetween(userAId: string, userBId: string) {
    const [friendship] = await this.databaseService.db
      .select({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      })
      .from(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userAId),
            eq(friendships.addresseeId, userBId),
          ),
          and(
            eq(friendships.requesterId, userBId),
            eq(friendships.addresseeId, userAId),
          ),
        ),
      )
      .limit(1);

    return friendship ?? null;
  }

  async createFriendRequest(
    requesterId: string,
    addresseeId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [friendship] = await db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: 'pending',
      })
      .returning({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      });

    return friendship;
  }

  async acceptFriendRequest(
    friendshipId: string,
    addresseeId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [friendship] = await db
      .update(friendships)
      .set({
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.addresseeId, addresseeId),
          eq(friendships.status, 'pending'),
        ),
      )
      .returning({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      });

    return friendship ?? null;
  }

  async rejectFriendRequest(
    friendshipId: string,
    addresseeId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [friendship] = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.addresseeId, addresseeId),
          eq(friendships.status, 'pending'),
        ),
      )
      .returning({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
      });

    return friendship ?? null;
  }

  async cancelFriendRequest(
    friendshipId: string,
    requesterId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [friendship] = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.requesterId, requesterId),
          eq(friendships.status, 'pending'),
        ),
      )
      .returning({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
      });

    return friendship ?? null;
  }

  async removeFriend(
    friendshipId: string,
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [friendship] = await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
        ),
      )
      .returning({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
      });

    return friendship ?? null;
  }

  async listFriends(userId: string) {
    return this.databaseService.db
      .select({
        friendshipId: friendships.id,
        userId: friend.id,
        email: friend.email,
        username: friend.username,
        avatarObjectKey: friend.avatarObjectKey,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      })
      .from(friendships)
      .innerJoin(
        friend,
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friend.id, friendships.addresseeId),
          ),
          and(
            eq(friendships.addresseeId, userId),
            eq(friend.id, friendships.requesterId),
          ),
        ),
      )
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
          isNull(friend.deletedAt),
        ),
      );
  }

  async listFriendRequests(userId: string) {
    return this.databaseService.db
      .select({
        friendshipId: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        requesterUsername: requester.username,
        requesterAvatarObjectKey: requester.avatarObjectKey,
        addresseeUsername: addressee.username,
        addresseeAvatarObjectKey: addressee.avatarObjectKey,
        status: friendships.status,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
      })
      .from(friendships)
      .innerJoin(requester, eq(requester.id, friendships.requesterId))
      .innerJoin(addressee, eq(addressee.id, friendships.addresseeId))
      .where(
        and(
          eq(friendships.status, 'pending'),
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
          isNull(requester.deletedAt),
          isNull(addressee.deletedAt),
        ),
      );
  }

  isUniquePairViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}

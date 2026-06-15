import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../../infra/database/database.service';
import { users } from '../../infra/database/schema';
import { getUsernamePrefixUpperBound } from '../users.helpers';
import type { UserSearchCursor, UserSearchRow } from '../users.types';

type UpdateUserInput = {
  username?: string;
  bio?: string | null;
};

@Injectable()
export class UsersProfileRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async findActiveUserById(userId: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        bio: users.bio,
        avatarObjectKey: users.avatarObjectKey,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async findActiveUserByUsername(username: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        bio: users.bio,
        avatarObjectKey: users.avatarObjectKey,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async findUserByUsername(username: string) {
    const [user] = await this.databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user ?? null;
  }

  async searchUsersByUsernamePrefix(input: {
    query: string;
    limit: number;
    cursor?: UserSearchCursor;
  }): Promise<UserSearchRow[]> {
    const upperBound = getUsernamePrefixUpperBound(input.query);

    return this.databaseService.db
      .select({
        id: users.id,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.status, 'active'),
          gte(users.username, input.query),
          upperBound ? lt(users.username, upperBound) : undefined,
          input.cursor
            ? or(
                gt(users.username, input.cursor.username),
                and(
                  eq(users.username, input.cursor.username),
                  gt(users.id, input.cursor.userId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(users.username), asc(users.id))
      .limit(input.limit + 1);
  }

  async updateUser(
    userId: string,
    input: UpdateUserInput,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [user] = await db
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        bio: users.bio,
        avatarObjectKey: users.avatarObjectKey,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user ?? null;
  }

  async deleteUser(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [user] = await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        tokenVersion: sql`${users.tokenVersion} + 1`,
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
      });

    return user ?? null;
  }
}

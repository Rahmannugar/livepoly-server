import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../infra/database/database.service';
import { users } from '../infra/database/schema';

type UpdateUserInput = {
  username?: string;
  bio?: string | null;
};

@Injectable()
export class UsersRepository {
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
        username: users.username,
        bio: users.bio,
        avatarObjectKey: users.avatarObjectKey,
        createdAt: users.createdAt,
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

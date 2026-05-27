import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../infra/database/database.service';
import { sessions, users } from '../infra/database/schema';
import type { UserStatus } from '../auth/types/auth-user.type';

@Injectable()
export class AdminRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async findUserByUsername(username: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        status: users.status,
        tokenVersion: users.tokenVersion,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.username, username), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [user] = await db
      .update(users)
      .set({
        status,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        status: users.status,
        tokenVersion: users.tokenVersion,
      });

    return user ?? null;
  }

  async revokeUserSessions(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const revokedSessions = await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
      })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({
        id: sessions.id,
        refreshTokenHash: sessions.refreshTokenHash,
      });

    return revokedSessions;
  }
}

import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, isNull, or } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../database/database.service';
import { sessions, users } from '../database/schema';

type CreateUserInput = {
  email: string;
  username: string;
  passwordHash: string;
};

type CreateSessionInput = {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async findUserByEmailOrUsername(email: string, username: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    return user ?? null;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
        tokenVersion: users.tokenVersion,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async createUser(input: CreateUserInput) {
    const [user] = await this.databaseService.db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash: input.passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
      });

    return user;
  }

  async markEmailVerified(userId: string) {
    await this.databaseService.db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async countActiveSessions(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [result] = await db
      .select({ count: count() })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    return result.count;
  }

  async revokeOldestActiveSession(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [oldestSession] = await db
      .select({
        id: sessions.id,
        refreshTokenHash: sessions.refreshTokenHash,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(sessions.createdAt))
      .limit(1);

    if (!oldestSession) {
      return;
    }

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, oldestSession.id));

    return oldestSession;
  }

  async createSession(input: CreateSessionInput, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [session] = await db
      .insert(sessions)
      .values({
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      })
      .returning({
        id: sessions.id,
        userId: sessions.userId,
        refreshTokenHash: sessions.refreshTokenHash,
        expiresAt: sessions.expiresAt,
      });

    return session;
  }
}

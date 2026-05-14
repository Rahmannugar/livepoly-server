import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../infra/database/database.service';
import { oauthAccounts, sessions, users } from '../infra/database/schema';
import { OAuthProvider } from './auth.types';

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

  async findUserByUsername(username: string) {
    const [user] = await this.databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user ?? null;
  }

  async findUserByOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        tokenVersion: users.tokenVersion,
        emailVerified: users.emailVerified,
      })
      .from(oauthAccounts)
      .innerJoin(users, eq(oauthAccounts.userId, users.id))
      .where(
        and(
          eq(oauthAccounts.provider, provider),
          eq(oauthAccounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  async linkOAuthAccount(
    input: {
      userId: string;
      provider: OAuthProvider;
      providerAccountId: string;
      providerEmail: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    await db.insert(oauthAccounts).values({
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      providerEmail: input.providerEmail,
    });
  }

  async createOAuthUser(
    input: {
      email: string;
      username: string;
      provider: OAuthProvider;
      providerAccountId: string;
      providerEmail: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash: null,
        emailVerified: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        tokenVersion: users.tokenVersion,
        emailVerified: users.emailVerified,
      });

    await db.insert(oauthAccounts).values({
      userId: user.id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      providerEmail: input.providerEmail,
    });

    return user;
  }

  async updateOAuthAccountEmail(
    input: {
      provider: OAuthProvider;
      providerAccountId: string;
      providerEmail: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    await db
      .update(oauthAccounts)
      .set({
        providerEmail: input.providerEmail,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(oauthAccounts.provider, input.provider),
          eq(oauthAccounts.providerAccountId, input.providerAccountId),
        ),
      );
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

  async markEmailVerified(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    await db
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

  async findUserByIdForAuthToken(userId: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        tokenVersion: users.tokenVersion,
        emailVerified: users.emailVerified,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }

  async findActiveSessionByRefreshTokenHash(refreshTokenHash: string) {
    const [session] = await this.databaseService.db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        refreshTokenHash: sessions.refreshTokenHash,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, refreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async rotateSessionRefreshToken(
    input: {
      sessionId: string;
      currentRefreshTokenHash: string;
      nextRefreshTokenHash: string;
      expiresAt: Date;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [session] = await db
      .update(sessions)
      .set({
        refreshTokenHash: input.nextRefreshTokenHash,
        expiresAt: input.expiresAt,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.id, input.sessionId),
          eq(sessions.refreshTokenHash, input.currentRefreshTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .returning({
        id: sessions.id,
        userId: sessions.userId,
        refreshTokenHash: sessions.refreshTokenHash,
        expiresAt: sessions.expiresAt,
      });

    return session ?? null;
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [user] = await db
      .update(users)
      .set({
        passwordHash,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        tokenVersion: users.tokenVersion,
      });

    return user;
  }

  async revokeSession(refreshTokenHash: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [session] = await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.refreshTokenHash, refreshTokenHash),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({
        id: sessions.id,
        refreshTokenHash: sessions.refreshTokenHash,
      });

    return session ?? null;
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

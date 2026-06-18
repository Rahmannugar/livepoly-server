import { Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  DatabaseExecutor,
  DatabaseService,
} from '../infra/database/database.service';
import { notifications } from '../infra/database/schema';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'room_invite'
  | 'leaderboard'
  | 'game_finished'
  | 'turn_reminder'
  | 'system';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: unknown;
};

type ListNotificationsInput = {
  userId: string;
  limit: number;
  cursor?: {
    createdAt: Date;
    id: string;
  };
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async createNotification(
    input: CreateNotificationInput,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
      })
      .returning({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        read: notifications.read,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      });

    return notification;
  }

  async listNotifications(input: ListNotificationsInput) {
    return this.databaseService.db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        read: notifications.read,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          input.cursor
            ? or(
                lt(notifications.createdAt, input.cursor.createdAt),
                and(
                  eq(notifications.createdAt, input.cursor.createdAt),
                  lt(notifications.id, input.cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(input.limit + 1);
  }

  async findLeaderboardNotification(input: {
    userId: string;
    leaderboardKey: string;
  }) {
    const [notification] = await this.databaseService.db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        read: notifications.read,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, 'leaderboard'),
          sql`${notifications.data}->>'leaderboardKey' = ${input.leaderboardKey}`,
        ),
      )
      .limit(1);

    return notification ?? null;
  }

  async markAsRead(notificationId: string, userId: string) {
    const [notification] = await this.databaseService.db
      .update(notifications)
      .set({
        read: true,
        readAt: sql`coalesce(${notifications.readAt}, now())`,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        data: notifications.data,
        read: notifications.read,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      });

    return notification ?? null;
  }

  async markAllAsRead(userId: string) {
    await this.databaseService.db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false)),
      );
  }
}

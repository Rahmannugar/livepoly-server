import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id, updatedAt } from './schema.helpers';

export const notificationTypeEnum = pgEnum('notification_type', [
  'friend_request',
  'friend_accepted',
  'room_invite',
  'game_started',
  'game_finished',
  'turn_reminder',
  'system',
]);

export const notifications = pgTable(
  TABLE_NAMES.notifications,
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    read: boolean('read').notNull().default(false),
    createdAt: createdAt(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('notifications_user_id_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('notifications_user_id_read_idx').on(table.userId, table.read),
    check(
      'notifications_read_state_chk',
      sql`
        (
          ${table.read} = false
          and ${table.readAt} is null
        )
        or
        (
          ${table.read} = true
          and ${table.readAt} is not null
        )
      `,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  TABLE_NAMES.pushSubscriptions,
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    keys: jsonb('keys').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_unique_idx').on(table.endpoint),
    index('push_subscriptions_user_id_idx').on(table.userId),
  ],
);

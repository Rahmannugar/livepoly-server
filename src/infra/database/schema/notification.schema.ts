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
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id } from './schema.helpers';

export const notificationTypeEnum = pgEnum('notification_type', [
  'friend_request',
  'friend_accepted',
  'room_invite',
  'leaderboard',
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

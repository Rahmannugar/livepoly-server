import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id } from './schema.helpers';

export const roomStatusEnum = pgEnum('room_status', [
  'waiting',
  'active',
  'finished',
  'cancelled',
]);

export const roomPlayerTypeEnum = pgEnum('room_player_type', ['human', 'bot']);

export const botDifficultyEnum = pgEnum('bot_difficulty', [
  'easy',
  'normal',
  'hard',
]);

export const roomPlayerStatusEnum = pgEnum('room_player_status', [
  'joined',
  'left',
  'kicked',
]);

export const rooms = pgTable(
  TABLE_NAMES.rooms,
  {
    id: id(),
    code: text('code').notNull(),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: roomStatusEnum('status').notNull().default('waiting'),
    maxPlayers: integer('max_players').notNull().default(4),
    durationMinutes: integer('duration_minutes').notNull(),
    boardKey: text('board_key').notNull().default('classic'),
    createdAt: createdAt(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('rooms_code_unique_idx').on(table.code),
    index('rooms_host_user_id_idx').on(table.hostUserId),
    index('rooms_status_idx').on(table.status),
    index('rooms_created_at_idx').on(table.createdAt),
    check('rooms_max_players_chk', sql`${table.maxPlayers} = 4`),
    check(
      'rooms_duration_minutes_chk',
      sql`${table.durationMinutes} in (90, 120)`,
    ),
    check('rooms_code_format_chk', sql`${table.code} ~ '^[A-Za-z0-9]{8}$'`),
  ],
);

export const roomPlayers = pgTable(
  TABLE_NAMES.roomPlayers,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    playerType: roomPlayerTypeEnum('player_type').notNull(),
    botDifficulty: botDifficultyEnum('bot_difficulty'),
    botName: text('bot_name'),
    seatNumber: integer('seat_number').notNull(),
    status: roomPlayerStatusEnum('status').notNull().default('joined'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('room_players_room_id_id_unique_idx').on(
      table.roomId,
      table.id,
    ),
    uniqueIndex('room_players_active_room_user_unique_idx')
      .on(table.roomId, table.userId)
      .where(sql`${table.status} = 'joined' and ${table.userId} is not null`),
    uniqueIndex('room_players_active_room_seat_unique_idx')
      .on(table.roomId, table.seatNumber)
      .where(sql`${table.status} = 'joined'`),
    index('room_players_room_id_idx').on(table.roomId),
    index('room_players_user_id_idx').on(table.userId),
    index('room_players_player_type_idx').on(table.playerType),
    check(
      'room_players_seat_number_chk',
      sql`${table.seatNumber} between 1 and 4`,
    ),
    check(
      'room_players_human_or_bot_chk',
      sql`
        (
          ${table.playerType} = 'human'
          and ${table.userId} is not null
          and ${table.botDifficulty} is null
          and ${table.botName} is null
        )
        or
        (
          ${table.playerType} = 'bot'
          and ${table.userId} is null
          and ${table.botDifficulty} is not null
          and ${table.botName} is not null
        )
      `,
    ),
  ],
);

export const roomSpectators = pgTable(
  TABLE_NAMES.roomSpectators,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('room_spectators_active_room_user_unique_idx')
      .on(table.roomId, table.userId)
      .where(sql`${table.leftAt} is null`),
    index('room_spectators_room_id_idx').on(table.roomId),
    index('room_spectators_user_id_idx').on(table.userId),
  ],
);

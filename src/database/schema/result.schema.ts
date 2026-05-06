import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id } from './schema.helpers';
import { rooms, roomPlayers } from './room.schema';

export const gameEndReasonEnum = pgEnum('game_end_reason', [
  'bankruptcy',
  'time_elapsed',
  'cancelled',
]);

export const leaderboardPeriodEnum = pgEnum('leaderboard_period', [
  'weekly',
  'monthly',
]);

export const roomResults = pgTable(
  TABLE_NAMES.roomResults,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    winnerRoomPlayerId: uuid('winner_room_player_id')
      .notNull()
      .references(() => roomPlayers.id, { onDelete: 'restrict' }),
    winnerUserId: uuid('winner_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    endReason: gameEndReasonEnum('end_reason').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('room_results_room_id_unique_idx').on(table.roomId),
    index('room_results_winner_user_id_idx').on(table.winnerUserId),
    index('room_results_completed_at_idx').on(table.completedAt),
    index('room_results_winner_room_player_id_idx').on(
      table.winnerRoomPlayerId,
    ),
  ],
);

export const roomPlayerResults = pgTable(
  TABLE_NAMES.roomPlayerResults,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    seatNumber: integer('seat_number').notNull(),
    startingCash: integer('starting_cash').notNull(),
    finalCash: integer('final_cash').notNull(),
    finalNetWorth: integer('final_net_worth').notNull(),
    placement: integer('placement').notNull(),
    bankruptAt: timestamp('bankrupt_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('room_player_results_room_user_unique_idx').on(
      table.roomId,
      table.userId,
    ),
    uniqueIndex('room_player_results_room_seat_unique_idx').on(
      table.roomId,
      table.seatNumber,
    ),
    index('room_player_results_room_id_idx').on(table.roomId),
    index('room_player_results_user_id_idx').on(table.userId),
    index('room_player_results_placement_idx').on(table.placement),
  ],
);

export const ratingHistory = pgTable(
  TABLE_NAMES.ratingHistory,
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    ratingBefore: integer('rating_before').notNull(),
    ratingAfter: integer('rating_after').notNull(),
    ratingDelta: integer('rating_delta').notNull(),
    placement: integer('placement').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('rating_history_user_id_idx').on(table.userId),
    index('rating_history_room_id_idx').on(table.roomId),
    index('rating_history_created_at_idx').on(table.createdAt),
  ],
);

export const leaderboardSnapshots = pgTable(
  TABLE_NAMES.leaderboardSnapshots,
  {
    id: id(),
    periodType: leaderboardPeriodEnum('period_type').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    entries: jsonb('entries').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('leaderboard_snapshots_period_unique_idx').on(
      table.periodType,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

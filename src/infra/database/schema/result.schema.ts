import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { games } from './game.schema';
import { users } from './user.schema';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id } from './schema.helpers';
import { rooms, roomPlayers } from './room.schema';

export const gameEndReasonEnum = pgEnum('game_end_reason', [
  'bankruptcy',
  'time_elapsed',
  'abandoned',
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
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    winnerRoomPlayerId: uuid('winner_room_player_id'),
    winnerUserId: uuid('winner_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    endReason: gameEndReasonEnum('end_reason').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('room_results_room_id_idx').on(table.roomId),
    uniqueIndex('room_results_game_id_unique_idx').on(table.gameId),
    index('room_results_winner_user_id_idx').on(table.winnerUserId),
    index('room_results_completed_at_idx').on(table.completedAt),
    index('room_results_winner_room_player_id_idx').on(
      table.winnerRoomPlayerId,
    ),
    check(
      'room_results_winner_required_chk',
      sql`
        (
          ${table.endReason} = 'cancelled'
          and ${table.winnerRoomPlayerId} is null
          and ${table.winnerUserId} is null
        )
        or
        (
          ${table.endReason} in ('bankruptcy', 'time_elapsed', 'abandoned')
          and ${table.winnerRoomPlayerId} is not null
        )
      `,
    ),
    check(
      'room_results_duration_seconds_chk',
      sql`${table.durationSeconds} >= 0`,
    ),
    foreignKey({
      name: 'room_results_winner_room_player_fk',
      columns: [table.roomId, table.winnerRoomPlayerId],
      foreignColumns: [roomPlayers.roomId, roomPlayers.id],
    }).onDelete('restrict'),
  ],
);

export const roomPlayerResults = pgTable(
  TABLE_NAMES.roomPlayerResults,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    roomPlayerId: uuid('room_player_id').notNull(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    seatNumber: integer('seat_number').notNull(),
    startingCash: integer('starting_cash').notNull(),
    finalCash: integer('final_cash').notNull(),
    finalNetWorth: integer('final_net_worth').notNull(),
    placement: integer('placement').notNull(),
    bankruptAt: timestamp('bankrupt_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('room_player_results_room_player_unique_idx').on(
      table.roomId,
      table.roomPlayerId,
    ),
    uniqueIndex('room_player_results_room_seat_unique_idx').on(
      table.roomId,
      table.seatNumber,
    ),
    index('room_player_results_room_id_idx').on(table.roomId),
    index('room_player_results_room_player_id_idx').on(table.roomPlayerId),
    index('room_player_results_user_id_idx').on(table.userId),
    index('room_player_results_placement_idx').on(table.placement),
    check(
      'room_player_results_seat_number_chk',
      sql`${table.seatNumber} between 1 and 4`,
    ),
    check(
      'room_player_results_placement_chk',
      sql`${table.placement} between 1 and 4`,
    ),
    check(
      'room_player_results_starting_cash_chk',
      sql`${table.startingCash} >= 0`,
    ),
    check('room_player_results_final_cash_chk', sql`${table.finalCash} >= 0`),
    check(
      'room_player_results_final_net_worth_chk',
      sql`${table.finalNetWorth} >= 0`,
    ),
    foreignKey({
      name: 'room_player_results_room_player_fk',
      columns: [table.roomId, table.roomPlayerId],
      foreignColumns: [roomPlayers.roomId, roomPlayers.id],
    }).onDelete('restrict'),
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
    uniqueIndex('rating_history_room_user_unique_idx').on(
      table.roomId,
      table.userId,
    ),
    check(
      'rating_history_placement_chk',
      sql`${table.placement} between 1 and 4`,
    ),
    check(
      'rating_history_rating_before_chk',
      sql`${table.ratingBefore} >= 300`,
    ),
    check('rating_history_rating_after_chk', sql`${table.ratingAfter} >= 300`),
  ],
);

export const leaderboardSnapshots = pgTable(
  TABLE_NAMES.leaderboardSnapshots,
  {
    id: id(),
    periodType: leaderboardPeriodEnum('period_type').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    entries: jsonb('entries').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('leaderboard_snapshots_period_unique_idx').on(
      table.periodType,
      table.periodStart,
      table.periodEnd,
    ),
    check(
      'leaderboard_snapshots_period_range_chk',
      sql`${table.periodStart} <= ${table.periodEnd}`,
    ),
  ],
);

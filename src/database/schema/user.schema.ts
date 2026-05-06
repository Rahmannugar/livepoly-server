import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id, updatedAt } from './schema.helpers';

export const friendshipStatusEnum = pgEnum('friendship_status', [
  'pending',
  'accepted',
  'blocked',
]);

export const users = pgTable(
  TABLE_NAMES.users,
  {
    id: id(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash'),
    emailVerified: boolean('email_verified').notNull().default(false),
    avatarObjectKey: text('avatar_object_key'),
    bio: text('bio'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_unique_idx').on(table.email),
    uniqueIndex('users_username_unique_idx').on(table.username),
  ],
);

export const friendships = pgTable(
  TABLE_NAMES.friendships,
  {
    id: id(),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum('status').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Canonical pair uniqueness prevents both A -> B and B -> A duplicates.
    uniqueIndex('friendships_user_pair_unique_idx').using(
      'btree',
      sql`LEAST(${table.requesterId}, ${table.addresseeId})`,
      sql`GREATEST(${table.requesterId}, ${table.addresseeId})`,
    ),
    check(
      'friendships_no_self_relationship_chk',
      sql`${table.requesterId} <> ${table.addresseeId}`,
    ),
    index('friendships_requester_status_idx').on(
      table.requesterId,
      table.status,
    ),
    index('friendships_addressee_status_idx').on(
      table.addresseeId,
      table.status,
    ),
  ],
);

export const playerStats = pgTable(
  TABLE_NAMES.playerStats,
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    gamesPlayed: integer('games_played').notNull().default(0),
    firstPlace: integer('first_place').notNull().default(0),
    secondPlace: integer('second_place').notNull().default(0),
    thirdPlace: integer('third_place').notNull().default(0),
    fourthPlace: integer('fourth_place').notNull().default(0),
    avgPosition: numeric('avg_position', { precision: 4, scale: 2 })
      .notNull()
      .default('0'),
    currentRating: integer('current_rating').notNull().default(1200),
    peakRating: integer('peak_rating').notNull().default(1200),
    totalNetWorth: bigint('total_net_worth', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    totalRentCollected: bigint('total_rent_collected', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    totalRentPaid: bigint('total_rent_paid', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('player_stats_current_rating_idx').on(table.currentRating),
    index('player_stats_games_played_idx').on(table.gamesPlayed),
    check('player_stats_games_played_chk', sql`${table.gamesPlayed} >= 0`),
    check('player_stats_first_place_chk', sql`${table.firstPlace} >= 0`),
    check('player_stats_second_place_chk', sql`${table.secondPlace} >= 0`),
    check('player_stats_third_place_chk', sql`${table.thirdPlace} >= 0`),
    check('player_stats_fourth_place_chk', sql`${table.fourthPlace} >= 0`),
    check('player_stats_avg_position_chk', sql`${table.avgPosition} >= 0`),
    check('player_stats_current_rating_chk', sql`${table.currentRating} > 0`),
    check('player_stats_peak_rating_chk', sql`${table.peakRating} > 0`),
    check(
      'player_stats_total_net_worth_chk',
      sql`${table.totalNetWorth} >= 0`,
    ),
    check(
      'player_stats_total_rent_collected_chk',
      sql`${table.totalRentCollected} >= 0`,
    ),
    check(
      'player_stats_total_rent_paid_chk',
      sql`${table.totalRentPaid} >= 0`,
    ),
  ],
);

import { sql } from 'drizzle-orm';
import {
  check,
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
import { TABLE_NAMES } from './schema.constants';
import { rooms, roomPlayers } from './room.schema';
import { createdAt, id, updatedAt } from './schema.helpers';

export const gameModeEnum = pgEnum('game_mode', ['ranked', 'casual']);

export const gameStatusEnum = pgEnum('game_status', [
  'active',
  'finished',
  'cancelled',
]);

export const games = pgTable(
  TABLE_NAMES.games,
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    mode: gameModeEnum('mode').notNull(),
    status: gameStatusEnum('status').notNull().default('active'),
    currentTurnRoomPlayerId: uuid('current_turn_room_player_id').notNull(),
    turnNumber: integer('turn_number').notNull().default(1),
    state: jsonb('state').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('games_room_id_unique_idx').on(table.roomId),
    index('games_status_idx').on(table.status),
    index('games_mode_idx').on(table.mode),
    index('games_current_turn_room_player_id_idx').on(
      table.currentTurnRoomPlayerId,
    ),
    check('games_turn_number_chk', sql`${table.turnNumber} > 0`),
    check(
      'games_finished_state_chk',
      sql`
        (
          ${table.status} = 'active'
          and ${table.finishedAt} is null
        )
        or
        (
          ${table.status} in ('finished', 'cancelled')
          and ${table.finishedAt} is not null
        )
      `,
    ),
    foreignKey({
      name: 'games_current_turn_room_player_fk',
      columns: [table.roomId, table.currentTurnRoomPlayerId],
      foreignColumns: [roomPlayers.roomId, roomPlayers.id],
    }).onDelete('restrict'),
  ],
);

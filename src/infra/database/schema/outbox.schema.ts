import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { TABLE_NAMES } from './schema.constants';
import { createdAt, id, updatedAt } from './schema.helpers';

export const outboxEventStatusEnum = pgEnum('outbox_event_status', [
  'queued',
  'processing',
  'published',
  'failed',
]);

export const outboxEvents = pgTable(
  TABLE_NAMES.outboxEvents,
  {
    id: id(),
    key: text('key').notNull(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxEventStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    error: text('error'),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('outbox_events_key_unique_idx').on(table.key),
    index('outbox_events_status_available_at_idx').on(
      table.status,
      table.availableAt,
    ),
    index('outbox_events_topic_status_idx').on(table.topic, table.status),
  ],
);

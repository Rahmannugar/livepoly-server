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

export const jobStatusEnum = pgEnum('job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);

export const jobs = pgTable(
  TABLE_NAMES.jobs,
  {
    id: id(),
    key: text('key').notNull(),
    type: text('type').notNull(),
    status: jobStatusEnum('status').notNull().default('queued'),
    payload: jsonb('payload').notNull(),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('jobs_key_unique_idx').on(table.key),
    index('jobs_status_available_at_idx').on(table.status, table.availableAt),
    index('jobs_type_status_idx').on(table.type, table.status),
  ],
);

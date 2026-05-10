import {
  index,
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

export const oauthProviderEnum = pgEnum('oauth_provider', [
  'google',
  'discord',
]);

export const sessions = pgTable(
  TABLE_NAMES.sessions,
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceName: text('device_name'),
    deviceType: text('device_type'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sessions_refresh_token_hash_unique_idx').on(
      table.refreshTokenHash,
    ),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_user_id_revoked_at_idx').on(table.userId, table.revokedAt),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const oauthAccounts = pgTable(
  TABLE_NAMES.oauthAccounts,
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: oauthProviderEnum('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    providerEmail: text('provider_email'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('oauth_accounts_provider_account_unique_idx').on(
      table.provider,
      table.providerAccountId,
    ),
    uniqueIndex('oauth_accounts_user_provider_unique_idx').on(
      table.userId,
      table.provider,
    ),
    index('oauth_accounts_user_id_idx').on(table.userId),
  ],
);

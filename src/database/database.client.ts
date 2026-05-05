import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

export const DATABASE = Symbol('DATABASE');

export type Database = ReturnType<typeof createDatabaseClient>;

export function createDatabaseClient(configService: ConfigService) {
  const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

  // Supabase transaction-pooler connections do not support prepared statements reliably.
  const client = postgres(databaseUrl, {
    prepare: false,
  });

  return drizzle(client, {
    schema,
  });
}

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    prepare: false,
  });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: './drizzle',
    });
    console.info('Database migrations completed');
  } finally {
    await client.end({ timeout: 5 });
  }
}

void runMigrations().catch((error: unknown) => {
  console.error('Database migration failed', error);
  process.exitCode = 1;
});

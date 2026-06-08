import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import { schema } from './schema';
import { sql } from 'drizzle-orm';

type Database = ReturnType<typeof drizzle<typeof schema>>;
type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

export type DatabaseExecutor = Database | DatabaseTransaction;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client: Sql;
  readonly db: Database;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

    this.client = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 5,
      // Supabase transaction pooler does not reliably support prepared statements.
      prepare: false,
    });

    this.db = drizzle(this.client, {
      schema,
    });
  }

  transaction<T>(callback: (tx: DatabaseTransaction) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

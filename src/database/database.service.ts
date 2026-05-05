import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { Sql } from 'postgres';
import { schema } from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly client: Sql;
  readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');

    this.client = postgres(databaseUrl, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 5,
      // Supabase transaction pooler does not reliably support prepared statements.
      prepare: false,
    });

    this.db = drizzle(this.client, {
      schema,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

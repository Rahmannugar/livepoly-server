import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from '../infra/database/database.service';
import type { DatabaseExecutor } from '../infra/database/database.service';
import { outboxEvents } from '../infra/database/schema';
import type { CreateOutboxEventInput } from './outbox.types';

@Injectable()
export class OutboxRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async createOrGet(
    input: CreateOutboxEventInput,
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [event] = await db
      .insert(outboxEvents)
      .values({
        key: input.key,
        topic: input.topic,
        payload: input.payload,
        maxAttempts: input.maxAttempts ?? 3,
      })
      .onConflictDoUpdate({
        target: outboxEvents.key,
        set: {
          updatedAt: sql`${outboxEvents.updatedAt}`,
        },
      })
      .returning();

    return event;
  }
}

import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../infra/database/database.service';
import type { DatabaseExecutor } from '../infra/database/database.service';
import { outboxEvents } from '../infra/database/schema';
import type { CreateOutboxEventInput } from './outbox.types';

const STALE_PROCESSING_MINUTES = 10;
const RETRY_DELAY_MS = 30_000;

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

  async findAvailable(limit: number) {
    return this.databaseService.db
      .select({
        id: outboxEvents.id,
      })
      .from(outboxEvents)
      .where(
        and(
          inArray(outboxEvents.status, ['queued', 'failed']),
          lte(outboxEvents.availableAt, new Date()),
          sql`${outboxEvents.attempts} < ${outboxEvents.maxAttempts}`,
        ),
      )
      .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
      .limit(limit);
  }

  async start(eventId: string) {
    const staleProcessingBefore = new Date(
      Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000,
    );

    const [event] = await this.databaseService.db
      .update(outboxEvents)
      .set({
        status: 'processing',
        attempts: sql`${outboxEvents.attempts} + 1`,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboxEvents.id, eventId),
          sql`${outboxEvents.attempts} < ${outboxEvents.maxAttempts}`,
          or(
            and(
              inArray(outboxEvents.status, ['queued', 'failed']),
              lte(outboxEvents.availableAt, new Date()),
            ),
            and(
              eq(outboxEvents.status, 'processing'),
              lt(outboxEvents.startedAt, staleProcessingBefore),
            ),
          ),
        ),
      )
      .returning({
        id: outboxEvents.id,
        key: outboxEvents.key,
        topic: outboxEvents.topic,
        payload: outboxEvents.payload,
        attempts: outboxEvents.attempts,
        maxAttempts: outboxEvents.maxAttempts,
      });

    return event ?? null;
  }

  async markPublished(eventId: string) {
    await this.databaseService.db
      .update(outboxEvents)
      .set({
        status: 'published',
        publishedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async markFailed(eventId: string, error: string) {
    await this.databaseService.db
      .update(outboxEvents)
      .set({
        status: 'failed',
        failedAt: new Date(),
        error,
        availableAt: new Date(Date.now() + RETRY_DELAY_MS),
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, eventId));
  }
}

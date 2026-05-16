import { Injectable } from '@nestjs/common';
import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../infra/database/database.service';
import { jobs } from '../infra/database/schema';
import type { CreateJobInput } from './job.types';

@Injectable()
export class JobsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(jobId: string) {
    const [job] = await this.databaseService.db
      .select({
        id: jobs.id,
        status: jobs.status,
        attempts: jobs.attempts,
        maxAttempts: jobs.maxAttempts,
        startedAt: jobs.startedAt,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    return job ?? null;
  }

  async createOrGet(input: CreateJobInput) {
    const [job] = await this.databaseService.db
      .insert(jobs)
      .values({
        key: input.key,
        type: input.type,
        payload: input.payload,
        maxAttempts: input.maxAttempts ?? 3,
      })
      .onConflictDoUpdate({
        target: jobs.key,
        set: {
          updatedAt: sql`${jobs.updatedAt}`,
        },
      })
      .returning();

    return job;
  }

  async start(jobId: string) {
    const staleProcessingBefore = new Date(Date.now() - 10 * 60 * 1000);

    const [job] = await this.databaseService.db
      .update(jobs)
      .set({
        status: 'processing',
        attempts: sql`${jobs.attempts} + 1`,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobs.id, jobId),
          sql`${jobs.attempts} < ${jobs.maxAttempts}`,
          or(
            inArray(jobs.status, ['queued', 'failed']),
            and(
              eq(jobs.status, 'processing'),
              lt(jobs.startedAt, staleProcessingBefore),
            ),
          ),
        ),
      )
      .returning();

    return job ?? null;
  }

  async complete(jobId: string) {
    await this.databaseService.db
      .update(jobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  async fail(jobId: string, error: string) {
    await this.databaseService.db
      .update(jobs)
      .set({
        status: 'failed',
        failedAt: new Date(),
        error,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }
}

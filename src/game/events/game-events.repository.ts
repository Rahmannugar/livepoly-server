import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, max, sql } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import { gameEvents } from '../../infra/database/schema';
import type { GameEngineEvent } from '../engine/game-engine.types';
import type { GameEventLogRecord } from './game-events.types';

@Injectable()
export class GameEventsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async appendEvents(
    gameId: string,
    events: GameEngineEvent[],
    executor?: DatabaseExecutor,
  ): Promise<GameEventLogRecord[]> {
    if (events.length === 0) {
      return [];
    }

    if (executor) {
      return this.appendEventsWithExecutor(gameId, events, executor);
    }

    return this.databaseService.transaction((tx) =>
      this.appendEventsWithExecutor(gameId, events, tx),
    );
  }

  async listEventsAfter(input: {
    gameId: string;
    sequence: number;
    limit: number;
  }): Promise<GameEventLogRecord[]> {
    const events = await this.databaseService.db
      .select({
        id: gameEvents.id,
        gameId: gameEvents.gameId,
        sequence: gameEvents.sequence,
        type: gameEvents.type,
        payload: gameEvents.payload,
        createdAt: gameEvents.createdAt,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.gameId, input.gameId),
          gt(gameEvents.sequence, input.sequence),
        ),
      )
      .orderBy(gameEvents.sequence)
      .limit(input.limit);

    return events.map((event) => ({
      ...event,
      payload: event.payload as GameEngineEvent,
    }));
  }

  async listLatestEvents(input: {
    gameId: string;
    limit: number;
  }): Promise<GameEventLogRecord[]> {
    const events = await this.databaseService.db
      .select({
        id: gameEvents.id,
        gameId: gameEvents.gameId,
        sequence: gameEvents.sequence,
        type: gameEvents.type,
        payload: gameEvents.payload,
        createdAt: gameEvents.createdAt,
      })
      .from(gameEvents)
      .where(eq(gameEvents.gameId, input.gameId))
      .orderBy(desc(gameEvents.sequence))
      .limit(input.limit);

    return events.reverse().map((event) => ({
      ...event,
      payload: event.payload as GameEngineEvent,
    }));
  }

  private async appendEventsWithExecutor(
    gameId: string,
    events: GameEngineEvent[],
    executor: DatabaseExecutor,
  ): Promise<GameEventLogRecord[]> {
    await this.lockGameEventSequence(gameId, executor);

    const nextSequence = await this.getNextSequence(gameId, executor);

    const rows = events.map((event, index) => ({
      gameId,
      sequence: nextSequence + index,
      type: event.type,
      payload: event,
    }));

    const savedEvents = await executor
      .insert(gameEvents)
      .values(rows)
      .returning({
        id: gameEvents.id,
        gameId: gameEvents.gameId,
        sequence: gameEvents.sequence,
        type: gameEvents.type,
        payload: gameEvents.payload,
        createdAt: gameEvents.createdAt,
      });

    return savedEvents.map((event) => ({
      ...event,
      payload: event.payload as GameEngineEvent,
    }));
  }

  private async getNextSequence(
    gameId: string,
    executor: DatabaseExecutor,
  ): Promise<number> {
    const [result] = await executor
      .select({ value: max(gameEvents.sequence) })
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId));

    return (result.value ?? 0) + 1;
  }

  private async lockGameEventSequence(
    gameId: string,
    executor: DatabaseExecutor,
  ): Promise<void> {
    await executor.execute(sql`
      select pg_advisory_xact_lock(hashtext(${gameId}))
    `);
  }
}

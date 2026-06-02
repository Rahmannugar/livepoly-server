import { BadRequestException, Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import type { GameEngineEvent } from '../engine/game-engine.types';
import { GameEventsRepository } from './game-events.repository';
import type {
  GameEventCursor,
  GameEventLogRecord,
  GameEventRecoveryResponse,
} from './game-events.types';

const GAME_EVENT_RECOVERY_LIMIT = 100;

@Injectable()
export class GameEventsService {
  constructor(private readonly gameEventsRepository: GameEventsRepository) {}

  async appendEvents(
    gameId: string,
    events: GameEngineEvent[],
    executor?: DatabaseExecutor,
  ): Promise<void> {
    await this.gameEventsRepository.appendEvents(gameId, events, executor);
  }

  async listEvents(input: {
    gameId: string;
    cursor?: string;
  }): Promise<GameEventRecoveryResponse> {
    const cursor = this.decodeCursor(input.cursor);

    const rows = cursor
      ? await this.gameEventsRepository.listEventsAfter({
          gameId: input.gameId,
          sequence: cursor.sequence,
          limit: GAME_EVENT_RECOVERY_LIMIT + 1,
        })
      : await this.gameEventsRepository.listLatestEvents({
          gameId: input.gameId,
          limit: GAME_EVENT_RECOVERY_LIMIT + 1,
        });

    const items = rows.slice(0, GAME_EVENT_RECOVERY_LIMIT);

    return {
      items: items.map((item) => this.mapEvent(item)),
      nextCursor:
        items.length > 0
          ? this.encodeCursor({ sequence: items[items.length - 1].sequence })
          : null,
      hasMore: rows.length > GAME_EVENT_RECOVERY_LIMIT,
    };
  }

  private mapEvent(event: GameEventLogRecord) {
    return {
      sequence: event.sequence,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private encodeCursor(cursor: GameEventCursor): string {
    return Buffer.from(JSON.stringify({ v: 1, ...cursor })).toString(
      'base64url',
    );
  }

  private decodeCursor(cursor?: string): GameEventCursor | undefined {
    if (!cursor) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: number;
        sequence?: number;
      };

      if (
        decoded.v !== 1 ||
        typeof decoded.sequence !== 'number' ||
        decoded.sequence < 0
      ) {
        throw new Error('Invalid game event cursor');
      }

      return {
        sequence: decoded.sequence,
      };
    } catch {
      throw new BadRequestException('Invalid game event cursor');
    }
  }
}

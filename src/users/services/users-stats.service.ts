import { BadRequestException, Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';
import { CacheService } from '../../infra/cache/cache.service';
import { ListUserMatchesDto } from '../dto/list-user-matches.dto';
import { UsersStatsRepository } from '../repositories/users-stats.repository';
import { USER_MATCH_HISTORY } from '../users.constants';
import type {
  UserMatchCursor,
  UserMatchHistoryItem,
  UserMatchHistoryResponse,
  UserMatchHistoryRow,
} from '../users.types';

@Injectable()
export class UsersStatsService {
  constructor(
    private readonly usersStatsRepository: UsersStatsRepository,
    private readonly cacheService: CacheService,
  ) {}

  async getStats(userId: string) {
    return this.usersStatsRepository.getStats(userId);
  }

  async listMatches(
    username: string,
    dto: ListUserMatchesDto,
  ): Promise<UserMatchHistoryResponse> {
    const normalizedUsername = username.trim().toLowerCase();
    const limit = Math.min(
      dto.limit ?? USER_MATCH_HISTORY.defaultLimit,
      USER_MATCH_HISTORY.maxLimit,
    );
    const cursor = this.decodeMatchCursor(dto.cursor);

    if (!cursor) {
      return this.cacheService.getOrSet({
        key: `users:${normalizedUsername}:matches:first:${limit}`,
        ttlSeconds: USER_MATCH_HISTORY.firstPageTtlSeconds,
        ttlJitterRatio: USER_MATCH_HISTORY.ttlJitterRatio,
        factory: () =>
          this.loadMatchHistory({
            username: normalizedUsername,
            limit,
          }),
      });
    }

    return this.loadMatchHistory({
      username: normalizedUsername,
      limit,
      cursor,
    });
  }

  private async loadMatchHistory(input: {
    username: string;
    limit: number;
    cursor?: UserMatchCursor;
  }): Promise<UserMatchHistoryResponse> {
    const rows = await this.usersStatsRepository.listMatchesByUsername(input);
    const items = rows.slice(0, input.limit);

    return {
      items: items.map((row) => this.mapMatchHistoryRow(row)),
      nextCursor:
        rows.length > input.limit
          ? this.encodeMatchCursor(items[items.length - 1])
          : null,
    };
  }

  private mapMatchHistoryRow(row: UserMatchHistoryRow): UserMatchHistoryItem {
    return {
      gameId: row.gameId,
      roomId: row.roomId,
      roomCode: row.roomCode,
      mode: row.mode,
      placement: row.placement,
      playerCount: row.playerCount,
      won: row.won,
      endReason: row.endReason,
      finalCash: row.finalCash,
      finalNetWorth: row.finalNetWorth,
      bankruptAt: row.bankruptAt ? row.bankruptAt.toISOString() : null,
      ratingBefore: row.ratingBefore,
      ratingAfter: row.ratingAfter,
      ratingDelta: row.ratingDelta,
      durationSeconds: row.durationSeconds,
      completedAt: row.completedAt.toISOString(),
    };
  }

  private encodeMatchCursor(row: UserMatchHistoryRow): string {
    return Buffer.from(
      JSON.stringify({
        v: 1,
        completedAt: row.completedAt.toISOString(),
        roomResultId: row.roomResultId,
      }),
    ).toString('base64url');
  }

  private decodeMatchCursor(cursor?: string): UserMatchCursor | undefined {
    if (!cursor) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as {
        v?: number;
        completedAt?: string;
        roomResultId?: string;
      };

      if (decoded.v !== 1 || !decoded.completedAt || !decoded.roomResultId) {
        throw new Error('Invalid cursor payload');
      }

      const completedAt = new Date(decoded.completedAt);

      if (Number.isNaN(completedAt.getTime())) {
        throw new Error('Invalid cursor date');
      }

      return {
        completedAt,
        roomResultId: decoded.roomResultId,
      };
    } catch {
      throw new BadRequestException('Invalid match history cursor');
    }
  }
}

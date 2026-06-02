import { Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { DEFAULT_RATING } from '../../game/game.constants';
import { DatabaseService } from '../../infra/database/database.service';
import {
  games,
  playerStats,
  ratingHistory,
  roomPlayerResults,
  roomResults,
  rooms,
  users,
} from '../../infra/database/schema';
import type { UserMatchCursor, UserMatchHistoryRow } from '../users.types';

@Injectable()
export class UsersStatsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStats(userId: string) {
    const [stats] = await this.databaseService.db
      .select({
        gamesPlayed: playerStats.gamesPlayed,
        gamesWon: playerStats.firstPlace,
        averagePlacement: playerStats.avgPosition,
        rating: playerStats.currentRating,
      })
      .from(playerStats)
      .where(eq(playerStats.userId, userId))
      .limit(1);

    if (!stats) {
      return {
        gamesPlayed: 0,
        gamesWon: 0,
        averagePlacement: null,
        rating: DEFAULT_RATING,
      };
    }

    return {
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      averagePlacement:
        stats.gamesPlayed > 0 ? Number(stats.averagePlacement) : null,
      rating: stats.rating,
    };
  }

  async listMatchesByUsername(input: {
    username: string;
    limit: number;
    cursor?: UserMatchCursor;
  }): Promise<UserMatchHistoryRow[]> {
    return this.databaseService.db
      .select({
        roomResultId: roomResults.id,
        gameId: roomResults.gameId,
        roomId: roomResults.roomId,
        roomCode: rooms.code,
        mode: games.mode,
        placement: roomPlayerResults.placement,
        playerCount: sql<number>`
  (
    select count(*)::int
    from ${roomPlayerResults} as player_results_count
    where player_results_count.room_id = ${roomResults.roomId}
  )
`,
        won: sql<boolean>`${roomResults.winnerUserId} = ${users.id}`,
        endReason: roomResults.endReason,
        finalCash: roomPlayerResults.finalCash,
        finalNetWorth: roomPlayerResults.finalNetWorth,
        bankruptAt: roomPlayerResults.bankruptAt,
        ratingBefore: ratingHistory.ratingBefore,
        ratingAfter: ratingHistory.ratingAfter,
        ratingDelta: ratingHistory.ratingDelta,
        durationSeconds: roomResults.durationSeconds,
        completedAt: roomResults.completedAt,
      })
      .from(users)
      .innerJoin(roomPlayerResults, eq(roomPlayerResults.userId, users.id))
      .innerJoin(roomResults, eq(roomResults.roomId, roomPlayerResults.roomId))
      .innerJoin(games, eq(games.id, roomResults.gameId))
      .innerJoin(rooms, eq(rooms.id, roomResults.roomId))
      .leftJoin(
        ratingHistory,
        and(
          eq(ratingHistory.roomId, roomResults.roomId),
          eq(ratingHistory.userId, users.id),
        ),
      )
      .where(
        and(
          eq(users.username, input.username),
          input.cursor
            ? or(
                lt(roomResults.completedAt, input.cursor.completedAt),
                and(
                  eq(roomResults.completedAt, input.cursor.completedAt),
                  lt(roomResults.id, input.cursor.roomResultId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(roomResults.completedAt), desc(roomResults.id))
      .limit(input.limit + 1);
  }
}

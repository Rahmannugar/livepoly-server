import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DatabaseService } from '../infra/database/database.service';
import {
  games,
  leaderboardSnapshots,
  playerStats,
  roomPlayerResults,
  roomResults,
  users,
} from '../infra/database/schema';
import { LEADERBOARD_LIMIT } from './leaderboards.constants';
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardSnapshot,
} from './leaderboards.types';

@Injectable()
export class LeaderboardsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async buildSnapshotEntries(input: {
    periodStart: Date;
    periodEnd: Date;
  }): Promise<LeaderboardEntry[]> {
    const rows = await this.databaseService.db
      .select({
        userId: users.id,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
        rating: playerStats.currentRating,
        gamesPlayed: sql<number>`count(${roomPlayerResults.id})::int`,
        wins: sql<number>`
          coalesce(sum(case when ${roomPlayerResults.placement} = 1 then 1 else 0 end), 0)::int
        `,
        averagePlacement: sql<number>`
          round(avg(${roomPlayerResults.placement})::numeric, 2)::float
        `,
      })
      .from(roomPlayerResults)
      .innerJoin(roomResults, eq(roomResults.roomId, roomPlayerResults.roomId))
      .innerJoin(users, eq(users.id, roomPlayerResults.userId))
      .innerJoin(playerStats, eq(playerStats.userId, users.id))
      .innerJoin(games, eq(games.id, roomResults.gameId))
      .where(
        and(
          gte(roomResults.completedAt, input.periodStart),
          lte(roomResults.completedAt, input.periodEnd),
          eq(users.status, 'active'),
          eq(games.mode, 'ranked'),
        ),
      )
      .groupBy(
        users.id,
        users.username,
        users.avatarObjectKey,
        playerStats.currentRating,
      )
      .orderBy(
        desc(playerStats.currentRating),
        desc(
          sql`coalesce(sum(case when ${roomPlayerResults.placement} = 1 then 1 else 0 end), 0)`,
        ),
        sql`avg(${roomPlayerResults.placement}) asc`,
        desc(sql`count(${roomPlayerResults.id})`),
        users.username,
      )
      .limit(LEADERBOARD_LIMIT);

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      username: row.username,
      avatarObjectKey: row.avatarObjectKey,
      rating: row.rating,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      averagePlacement: row.averagePlacement,
    }));
  }

  async saveSnapshot(snapshot: LeaderboardSnapshot): Promise<void> {
    await this.databaseService.db.insert(leaderboardSnapshots).values({
      periodType: snapshot.period,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      entries: snapshot.entries,
    });
  }

  async findLatestSnapshot(
    period: LeaderboardPeriod,
  ): Promise<LeaderboardSnapshot | null> {
    const [snapshot] = await this.databaseService.db
      .select({
        period: leaderboardSnapshots.periodType,
        periodStart: leaderboardSnapshots.periodStart,
        periodEnd: leaderboardSnapshots.periodEnd,
        entries: leaderboardSnapshots.entries,
      })
      .from(leaderboardSnapshots)
      .where(eq(leaderboardSnapshots.periodType, period))
      .orderBy(desc(leaderboardSnapshots.createdAt))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    return {
      period: snapshot.period,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      entries: snapshot.entries as LeaderboardEntry[],
    };
  }
}

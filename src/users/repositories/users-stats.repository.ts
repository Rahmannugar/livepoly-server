import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import { ratingHistory, roomPlayerResults } from '../../infra/database/schema';

@Injectable()
export class UsersStatsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStats(userId: string) {
    const [summary] = await this.databaseService.db
      .select({
        gamesPlayed: sql<number>`count(*)::int`,
        gamesWon: sql<number>`
          coalesce(sum(case when ${roomPlayerResults.placement} = 1 then 1 else 0 end), 0)::int
        `,
        averagePlacement: sql<number | null>`
          round(avg(${roomPlayerResults.placement})::numeric, 2)::float
        `,
      })
      .from(roomPlayerResults)
      .where(eq(roomPlayerResults.userId, userId));

    const [latestRating] = await this.databaseService.db
      .select({
        rating: ratingHistory.ratingAfter,
      })
      .from(ratingHistory)
      .where(eq(ratingHistory.userId, userId))
      .orderBy(desc(ratingHistory.createdAt))
      .limit(1);

    return {
      gamesPlayed: summary?.gamesPlayed ?? 0,
      gamesWon: summary?.gamesWon ?? 0,
      averagePlacement: summary?.averagePlacement ?? null,
      rating: latestRating?.rating ?? null,
    };
  }
}

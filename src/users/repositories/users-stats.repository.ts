import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DEFAULT_RATING } from '../../game/game.constants';
import { DatabaseService } from '../../infra/database/database.service';
import { playerStats } from '../../infra/database/schema';

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
}

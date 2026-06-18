import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import { games } from '../../infra/database/schema';

export type ActiveGameTimerCandidate = {
  id: string;
  expiresAt: Date;
};

@Injectable()
export class GameTimerWatchdogRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActiveGames(limit: number): Promise<ActiveGameTimerCandidate[]> {
    return this.databaseService.db
      .select({
        id: games.id,
        expiresAt: games.expiresAt,
      })
      .from(games)
      .where(eq(games.status, 'active'))
      .orderBy(asc(games.expiresAt))
      .limit(limit);
  }
}

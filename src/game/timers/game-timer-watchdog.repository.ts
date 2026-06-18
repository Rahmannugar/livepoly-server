import { Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import { games, roomPlayers } from '../../infra/database/schema';

export type ActiveGameTimerCandidate = {
  id: string;
  roomId: string;
  expiresAt: Date;
};

@Injectable()
export class GameTimerWatchdogRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActiveGames(limit: number): Promise<ActiveGameTimerCandidate[]> {
    return this.databaseService.db
      .select({
        id: games.id,
        roomId: games.roomId,
        expiresAt: games.expiresAt,
      })
      .from(games)
      .where(eq(games.status, 'active'))
      .orderBy(asc(games.expiresAt))
      .limit(limit);
  }

  async countJoinedHumanPlayers(roomId: string): Promise<number> {
    const [result] = await this.databaseService.db
      .select({ value: count() })
      .from(roomPlayers)
      .where(
        and(
          eq(roomPlayers.roomId, roomId),
          eq(roomPlayers.playerType, 'human'),
          eq(roomPlayers.status, 'joined'),
        ),
      );

    return result?.value ?? 0;
  }
}

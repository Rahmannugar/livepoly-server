import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import { games, roomPlayers, rooms } from '../../infra/database/schema';

@Injectable()
export class GameAccessRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findActivePlayerForGame(gameId: string, userId: string) {
    const [player] = await this.databaseService.db
      .select({
        gameId: games.id,
        roomId: games.roomId,
        roomPlayerId: roomPlayers.id,
        userId: roomPlayers.userId,
      })
      .from(games)
      .innerJoin(rooms, eq(rooms.id, games.roomId))
      .innerJoin(roomPlayers, eq(roomPlayers.roomId, rooms.id))
      .where(
        and(
          eq(games.id, gameId),
          eq(games.status, 'active'),
          eq(rooms.status, 'active'),
          eq(roomPlayers.userId, userId),
          eq(roomPlayers.playerType, 'human'),
          eq(roomPlayers.status, 'joined'),
        ),
      )
      .limit(1);

    return player ?? null;
  }
}

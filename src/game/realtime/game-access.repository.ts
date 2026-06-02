import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import {
  games,
  roomPlayers,
  rooms,
  roomSpectators,
} from '../../infra/database/schema';

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

  async findCurrentSpectatorForGame(gameId: string, userId: string) {
    const [spectator] = await this.databaseService.db
      .select({
        gameId: games.id,
        roomId: games.roomId,
        spectatorId: roomSpectators.id,
        userId: roomSpectators.userId,
      })
      .from(games)
      .innerJoin(rooms, eq(rooms.id, games.roomId))
      .innerJoin(roomSpectators, eq(roomSpectators.roomId, rooms.id))
      .where(
        and(
          eq(games.id, gameId),
          eq(games.status, 'active'),
          eq(rooms.status, 'active'),
          eq(roomSpectators.userId, userId),
          isNull(roomSpectators.leftAt),
        ),
      )
      .limit(1);

    return spectator ?? null;
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import {
  games,
  roomPlayerResults,
  roomResults,
  roomPlayers,
  rooms,
} from '../../infra/database/schema';
import type { PersistGameResultsInput } from './game-results.types';

@Injectable()
export class GameResultsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findGameForFinalization(gameId: string, executor?: DatabaseExecutor) {
    const db = executor ?? this.databaseService.db;

    const [game] = await db
      .select({
        id: games.id,
        roomId: games.roomId,
        mode: games.mode,
        status: games.status,
        startedAt: games.startedAt,
        finishedAt: games.finishedAt,
      })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    return game ?? null;
  }

  async findWinnerUserId(
    input: {
      roomId: string;
      winnerRoomPlayerId: string | null;
    },
    executor?: DatabaseExecutor,
  ): Promise<string | null> {
    if (!input.winnerRoomPlayerId) {
      return null;
    }

    const db = executor ?? this.databaseService.db;

    const [winner] = await db
      .select({
        userId: roomPlayers.userId,
      })
      .from(roomPlayers)
      .where(
        and(
          eq(roomPlayers.roomId, input.roomId),
          eq(roomPlayers.id, input.winnerRoomPlayerId),
        ),
      )
      .limit(1);

    return winner?.userId ?? null;
  }

  async persistFinishedGame(
    input: PersistGameResultsInput,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    const db = executor ?? this.databaseService.db;

    await db
      .update(games)
      .set({
        status: 'finished',
        currentTurnRoomPlayerId: input.state.currentTurnRoomPlayerId,
        turnNumber: input.state.turnNumber,
        state: input.state,
        finishedAt: input.completedAt,
      })
      .where(eq(games.id, input.gameId));

    await db
      .update(rooms)
      .set({
        status: 'finished',
        endedAt: input.completedAt,
      })
      .where(eq(rooms.id, input.roomId));

    const winnerUserId = await this.findWinnerUserId(
      {
        roomId: input.roomId,
        winnerRoomPlayerId: input.winnerRoomPlayerId,
      },
      db,
    );

    await db
      .insert(roomResults)
      .values({
        roomId: input.roomId,
        gameId: input.gameId,
        winnerRoomPlayerId: input.winnerRoomPlayerId,
        winnerUserId,
        endReason: input.endReason,
        durationSeconds: input.durationSeconds,
        completedAt: input.completedAt,
      })
      .onConflictDoUpdate({
        target: roomResults.gameId,
        set: {
          winnerRoomPlayerId: input.winnerRoomPlayerId,
          winnerUserId,
          endReason: input.endReason,
          durationSeconds: input.durationSeconds,
          completedAt: input.completedAt,
        },
      });

    for (const playerResult of input.playerResults) {
      await db
        .insert(roomPlayerResults)
        .values(playerResult)
        .onConflictDoUpdate({
          target: [roomPlayerResults.roomId, roomPlayerResults.roomPlayerId],
          set: {
            userId: playerResult.userId,
            seatNumber: playerResult.seatNumber,
            startingCash: playerResult.startingCash,
            finalCash: playerResult.finalCash,
            finalNetWorth: playerResult.finalNetWorth,
            placement: playerResult.placement,
            bankruptAt: playerResult.bankruptAt,
          },
        });
    }
  }
}

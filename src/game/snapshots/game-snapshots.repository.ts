import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import { gameSnapshots } from '../../infra/database/schema';
import type {
  CreateGameSnapshotInput,
  GameSnapshotRecord,
} from './game-snapshots.types';

@Injectable()
export class GameSnapshotRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    input: CreateGameSnapshotInput,
    executor?: DatabaseExecutor,
  ): Promise<GameSnapshotRecord> {
    const db = executor ?? this.databaseService.db;

    const [snapshot] = await db
      .insert(gameSnapshots)
      .values({
        gameId: input.gameId,
        roomId: input.roomId,
        snapshotType: input.snapshotType,
        turnNumber: input.state.turnNumber,
        state: input.state,
        stateVersion: input.state.version,
      })
      .onConflictDoUpdate({
        target: [
          gameSnapshots.gameId,
          gameSnapshots.snapshotType,
          gameSnapshots.turnNumber,
        ],
        set: {
          state: input.state,
          stateVersion: input.state.version,
        },
      })
      .returning({
        id: gameSnapshots.id,
        gameId: gameSnapshots.gameId,
        roomId: gameSnapshots.roomId,
        snapshotType: gameSnapshots.snapshotType,
        turnNumber: gameSnapshots.turnNumber,
        state: gameSnapshots.state,
        stateVersion: gameSnapshots.stateVersion,
        createdAt: gameSnapshots.createdAt,
      });

    return {
      ...snapshot,
      state: snapshot.state as GameSnapshotRecord['state'],
    };
  }

  async findLatestByGameId(gameId: string): Promise<GameSnapshotRecord | null> {
    const [snapshot] = await this.databaseService.db
      .select({
        id: gameSnapshots.id,
        gameId: gameSnapshots.gameId,
        roomId: gameSnapshots.roomId,
        snapshotType: gameSnapshots.snapshotType,
        turnNumber: gameSnapshots.turnNumber,
        state: gameSnapshots.state,
        stateVersion: gameSnapshots.stateVersion,
        createdAt: gameSnapshots.createdAt,
      })
      .from(gameSnapshots)
      .where(eq(gameSnapshots.gameId, gameId))
      .orderBy(desc(gameSnapshots.turnNumber), desc(gameSnapshots.createdAt))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot,
      state: snapshot.state as GameSnapshotRecord['state'],
    };
  }
}

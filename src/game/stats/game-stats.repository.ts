import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import { playerStats, ratingHistory } from '../../infra/database/schema';
import {
  RecordRatingChangeInput,
  PlayerStatsForUpdate,
  UpdatePlayerStatsInput,
} from './game-stats.types';

@Injectable()
export class GameStatsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createMissingPlayerStats(
    userIds: string[],
    executor?: DatabaseExecutor,
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const db = executor ?? this.databaseService.db;

    await db
      .insert(playerStats)
      .values(userIds.map((userId) => ({ userId })))
      .onConflictDoNothing({
        target: playerStats.userId,
      });
  }

  async lockPlayerStats(
    userIds: string[],
    executor?: DatabaseExecutor,
  ): Promise<PlayerStatsForUpdate[]> {
    if (userIds.length === 0) {
      return [];
    }

    const db = executor ?? this.databaseService.db;

    return db
      .select({
        userId: playerStats.userId,
        gamesPlayed: playerStats.gamesPlayed,
        firstPlace: playerStats.firstPlace,
        secondPlace: playerStats.secondPlace,
        thirdPlace: playerStats.thirdPlace,
        fourthPlace: playerStats.fourthPlace,
        avgPosition: playerStats.avgPosition,
        currentRating: playerStats.currentRating,
        peakRating: playerStats.peakRating,
        totalNetWorth: playerStats.totalNetWorth,
        totalRentCollected: playerStats.totalRentCollected,
        totalRentPaid: playerStats.totalRentPaid,
      })
      .from(playerStats)
      .where(inArray(playerStats.userId, userIds))
      .for('update');
  }

  async recordRatingChange(
    input: RecordRatingChangeInput,
    executor?: DatabaseExecutor,
  ): Promise<boolean> {
    const db = executor ?? this.databaseService.db;

    const inserted = await db
      .insert(ratingHistory)
      .values(input)
      .onConflictDoNothing({
        target: [ratingHistory.roomId, ratingHistory.userId],
      })
      .returning({
        id: ratingHistory.id,
      });

    return inserted.length > 0;
  }

  async updatePlayerStats(
    input: UpdatePlayerStatsInput,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    const db = executor ?? this.databaseService.db;

    await db
      .update(playerStats)
      .set({
        gamesPlayed: input.gamesPlayed,
        firstPlace: input.firstPlace,
        secondPlace: input.secondPlace,
        thirdPlace: input.thirdPlace,
        fourthPlace: input.fourthPlace,
        avgPosition: input.avgPosition.toFixed(2),
        currentRating: input.currentRating,
        peakRating: input.peakRating,
        totalNetWorth: input.totalNetWorth,
        totalRentCollected: input.totalRentCollected,
        totalRentPaid: input.totalRentPaid,
      })
      .where(eq(playerStats.userId, input.userId));
  }
}

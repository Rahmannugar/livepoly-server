import { Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import type { GameEngineState } from '../engine/game-engine.types';
import type { SaveRoomPlayerResultInput } from '../results/game-results.types';
import { GameRatingService } from './game-rating.service';
import { GameStatsRepository } from './game-stats.repository';

export type ApplyFinishedGameStatsInput = {
  roomId: string;
  state: GameEngineState;
  playerResults: SaveRoomPlayerResultInput[];
};

@Injectable()
export class GameStatsService {
  constructor(
    private readonly gameStatsRepository: GameStatsRepository,
    private readonly gameRatingService: GameRatingService,
  ) {}

  async applyFinishedGameStats(
    input: ApplyFinishedGameStatsInput,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    if (!this.shouldApplyStats(input.state)) {
      return;
    }

    const rankedResults = input.playerResults.filter(
      (result) => result.userId !== null,
    );

    const userIds = rankedResults.map((result) => result.userId as string);

    await this.gameStatsRepository.createMissingPlayerStats(userIds, executor);

    const currentStats = await this.gameStatsRepository.lockPlayerStats(
      userIds,
      executor,
    );

    const statsByUserId = new Map(
      currentStats.map((stats) => [stats.userId, stats]),
    );

    const ratingChanges = this.gameRatingService.calculateRatingChanges(
      rankedResults.map((result) => {
        const stats = statsByUserId.get(result.userId as string);

        if (!stats) {
          throw new Error('Player stats row missing after initialization');
        }

        return {
          userId: result.userId as string,
          placement: result.placement,
          rating: stats.currentRating,
        };
      }),
    );

    const ratingChangeByUserId = new Map(
      ratingChanges.map((change) => [change.userId, change]),
    );

    for (const result of rankedResults) {
      const userId = result.userId as string;
      const stats = statsByUserId.get(userId);
      const ratingChange = ratingChangeByUserId.get(userId);

      if (!stats || !ratingChange) {
        continue;
      }

      const ratingInserted = await this.gameStatsRepository.recordRatingChange(
        {
          userId,
          roomId: input.roomId,
          ratingBefore: ratingChange.ratingBefore,
          ratingAfter: ratingChange.ratingAfter,
          ratingDelta: ratingChange.ratingDelta,
          placement: result.placement,
        },
        executor,
      );

      if (!ratingInserted) {
        continue;
      }

      await this.gameStatsRepository.updatePlayerStats(
        this.buildUpdatedStats({
          stats,
          finalNetWorth: result.finalNetWorth,
          placement: result.placement,
          ratingAfter: ratingChange.ratingAfter,
        }),
        executor,
      );
    }
  }

  private shouldApplyStats(state: GameEngineState): boolean {
    if (state.mode !== 'ranked') {
      return false;
    }

    return state.players.every(
      (player) => player.playerType === 'human' && player.userId !== null,
    );
  }

  private buildUpdatedStats(input: {
    stats: Awaited<ReturnType<GameStatsRepository['lockPlayerStats']>>[number];
    finalNetWorth: number;
    placement: number;
    ratingAfter: number;
  }) {
    const gamesPlayed = input.stats.gamesPlayed + 1;
    const avgPosition =
      (Number(input.stats.avgPosition) * input.stats.gamesPlayed +
        input.placement) /
      gamesPlayed;

    return {
      userId: input.stats.userId,
      gamesPlayed,
      firstPlace: input.stats.firstPlace + (input.placement === 1 ? 1 : 0),
      secondPlace: input.stats.secondPlace + (input.placement === 2 ? 1 : 0),
      thirdPlace: input.stats.thirdPlace + (input.placement === 3 ? 1 : 0),
      fourthPlace: input.stats.fourthPlace + (input.placement === 4 ? 1 : 0),
      avgPosition,
      currentRating: input.ratingAfter,
      peakRating: Math.max(input.stats.peakRating, input.ratingAfter),
      totalNetWorth: input.stats.totalNetWorth + BigInt(input.finalNetWorth),
      totalRentCollected: input.stats.totalRentCollected,
      totalRentPaid: input.stats.totalRentPaid,
    };
  }
}

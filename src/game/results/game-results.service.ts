import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service';
import {
  calculateNetWorthStandings,
  getNetWorthWinner,
} from '../engine/game-engine-derived-state';
import type {
  GameEngineEvent,
  GameEngineState,
} from '../engine/game-engine.types';
import { GameSnapshotService } from '../snapshots/game-snapshots.service';
import { GameResultsRepository } from './game-results.repository';
import type {
  FinalizeGameResultInput,
  GameResultEndReason,
  SaveRoomPlayerResultInput,
} from './game-results.types';
import { GameStatsService } from '../stats/game-stats.service';
import { LeaderboardQueueService } from '../../leaderboards/jobs/leaderboard-queue.service';
import { DEFAULT_STARTING_CASH } from '../game.constants';

@Injectable()
export class GameResultsService {
  private readonly logger = new Logger(GameResultsService.name);

  constructor(
    private readonly gameResultsRepository: GameResultsRepository,
    private readonly databaseService: DatabaseService,
    private readonly gameSnapshotService: GameSnapshotService,
    private readonly gameStatsService: GameStatsService,
    private readonly leaderboardQueueService: LeaderboardQueueService,
  ) {}

  async finalizeFinishedGame(input: FinalizeGameResultInput): Promise<void> {
    if (input.state.phase !== 'finished') {
      return;
    }

    const game = await this.gameResultsRepository.findGameForFinalization(
      input.gameId,
    );

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const completedAt = this.getCompletedAt(input.events);
    const endReason = this.getEndReason(input.events);
    const winnerRoomPlayerId = this.getWinnerRoomPlayerId(
      input.events,
      input.state,
    );
    const durationSeconds = this.getDurationSeconds(input.state, completedAt);
    const playerResults = this.buildPlayerResults(input.state, completedAt);

    await this.databaseService.transaction(async (tx) => {
      await this.gameSnapshotService.createFinalSnapshot(
        input.gameId,
        input.state,
        tx,
      );

      await this.gameResultsRepository.saveFinishedGame(
        {
          gameId: input.gameId,
          roomId: input.state.roomId,
          state: input.state,
          endReason,
          winnerRoomPlayerId,
          completedAt,
          durationSeconds,
          playerResults,
        },
        tx,
      );

      await this.gameStatsService.applyFinishedGameStats(
        {
          roomId: input.state.roomId,
          state: input.state,
          playerResults,
        },
        tx,
      );
    });

    if (this.shouldRefreshLeaderboards(input.state)) {
      await this.enqueueLeaderboardRefresh(input.gameId);
    }
  }

  private getCompletedAt(events: GameEngineEvent[]): Date {
    const finishEvent = events.find(
      (event) =>
        event.type === 'game_finished_by_bankruptcy' ||
        event.type === 'game_finished_by_time',
    );

    if (finishEvent?.type === 'game_finished_by_time') {
      return new Date(finishEvent.finishedAt);
    }

    return new Date();
  }

  private getEndReason(events: GameEngineEvent[]): GameResultEndReason {
    if (events.some((event) => event.type === 'game_finished_by_bankruptcy')) {
      return 'bankruptcy';
    }

    if (events.some((event) => event.type === 'game_finished_by_time')) {
      return 'time_elapsed';
    }

    return 'cancelled';
  }

  private getWinnerRoomPlayerId(
    events: GameEngineEvent[],
    state: GameEngineState,
  ): string | null {
    const bankruptcyFinishEvent = events.find(
      (event) => event.type === 'game_finished_by_bankruptcy',
    );

    if (bankruptcyFinishEvent?.type === 'game_finished_by_bankruptcy') {
      return bankruptcyFinishEvent.winnerRoomPlayerId;
    }

    const timeFinishEvent = events.find(
      (event) => event.type === 'game_finished_by_time',
    );

    if (
      timeFinishEvent?.type === 'game_finished_by_time' &&
      timeFinishEvent.winnerRoomPlayerId
    ) {
      return timeFinishEvent.winnerRoomPlayerId;
    }

    return (
      getNetWorthWinner(calculateNetWorthStandings(state))?.roomPlayerId ?? null
    );
  }

  private getDurationSeconds(
    state: GameEngineState,
    completedAt: Date,
  ): number {
    const startedAt = state.startedAt ?? completedAt.getTime();

    return Math.max(0, Math.floor((completedAt.getTime() - startedAt) / 1000));
  }

  private buildPlayerResults(
    state: GameEngineState,
    completedAt: Date,
  ): SaveRoomPlayerResultInput[] {
    const standings = calculateNetWorthStandings(state);
    const placementByRoomPlayerId = new Map(
      standings.map((standing, index) => [standing.roomPlayerId, index + 1]),
    );

    return state.players.map((player) => {
      const standing = standings.find(
        (item) => item.roomPlayerId === player.roomPlayerId,
      );

      return {
        roomId: state.roomId,
        roomPlayerId: player.roomPlayerId,
        userId: player.userId,
        seatNumber: player.seatNumber,
        startingCash: DEFAULT_STARTING_CASH,
        finalCash: player.cash,
        finalNetWorth: standing?.netWorth ?? player.cash,
        placement:
          placementByRoomPlayerId.get(player.roomPlayerId) ??
          state.players.length,
        bankruptAt: player.bankrupt ? completedAt : null,
      };
    });
  }

  private shouldRefreshLeaderboards(state: GameEngineState): boolean {
    return (
      state.mode === 'ranked' &&
      state.players.every(
        (player) => player.playerType === 'human' && player.userId !== null,
      )
    );
  }

  private async enqueueLeaderboardRefresh(gameId: string): Promise<void> {
    try {
      await this.leaderboardQueueService.enqueueGameFinishedRefresh();
    } catch (error) {
      this.logger.warn({
        message:
          'Failed to enqueue leaderboard refresh after game finalization',
        gameId,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
    }
  }
}

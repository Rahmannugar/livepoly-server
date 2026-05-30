import { NotFoundException } from '@nestjs/common';
import { GameResultsService } from '../game-results.service';
import type { GameEngineState } from '../../engine/game-engine.types';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { LeaderboardQueueService } from '../../../leaderboards/jobs/leaderboard-queue.service';
import type { ObservabilityService } from '../../../infra/observability/observability.service';

describe('GameResultsService', () => {
  const gameId = 'game-1';
  const tx = Symbol('tx');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(46_000));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const makeFinishedState = (
    overrides: Partial<GameEngineState> = {},
  ): GameEngineState =>
    createGameEngineState({
      phase: 'finished',
      startedAt: 1_000,
      ...overrides,
    });

  const makeService = () => {
    const gameResultsRepository = {
      findGameForFinalization: jest.fn().mockResolvedValue({
        id: gameId,
        roomId: 'room-1',
        mode: 'ranked',
        status: 'active',
        startedAt: new Date(1_000),
        finishedAt: null,
      }),
      saveFinishedGame: jest.fn(),
    };

    const databaseService = {
      transaction: jest.fn(async (callback) => callback(tx)),
    };

    const gameSnapshotService = {
      createFinalSnapshot: jest.fn(),
    };

    const gameStatsService = {
      applyFinishedGameStats: jest.fn(),
    };

    const leaderboardQueueService = {
      enqueueGameFinishedRefresh: jest.fn(),
    };

    const observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    const service = new GameResultsService(
      gameResultsRepository as never,
      databaseService as never,
      gameSnapshotService as never,
      gameStatsService as never,
      leaderboardQueueService as unknown as LeaderboardQueueService,
      observabilityService as unknown as ObservabilityService,
    );

    return {
      service,
      gameResultsRepository,
      databaseService,
      gameSnapshotService,
      gameStatsService,
      leaderboardQueueService,
      observabilityService,
    };
  };

  it('does nothing for active games', async () => {
    const { service, gameResultsRepository, databaseService } = makeService();

    await service.finalizeFinishedGame({
      gameId,
      state: createGameEngineState({
        phase: 'awaiting_roll',
      }),
      events: [],
    });

    expect(
      gameResultsRepository.findGameForFinalization,
    ).not.toHaveBeenCalled();
    expect(databaseService.transaction).not.toHaveBeenCalled();
  });

  it('throws when the game does not exist', async () => {
    const { service, gameResultsRepository } = makeService();

    gameResultsRepository.findGameForFinalization.mockResolvedValue(null);

    await expect(
      service.finalizeFinishedGame({
        gameId,
        state: makeFinishedState(),
        events: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists bankruptcy results', async () => {
    const { service, gameResultsRepository, gameSnapshotService } =
      makeService();

    const state = makeFinishedState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-2') {
          return {
            ...player,
            cash: 0,
            bankrupt: true,
          };
        }

        return player;
      }),
    });

    await service.finalizeFinishedGame({
      gameId,
      state,
      events: [
        {
          type: 'game_finished_by_bankruptcy',
          winnerRoomPlayerId: 'room-player-1',
          tiedRoomPlayerIds: ['room-player-1'],
          standings: [
            {
              roomPlayerId: 'room-player-1',
              seatNumber: 1,
              cash: 1500,
              ownedPropertyCount: 0,
              assetValue: 0,
              netWorth: 1500,
            },
          ],
        },
      ],
    });

    expect(gameSnapshotService.createFinalSnapshot).toHaveBeenCalledWith(
      gameId,
      state,
      tx,
    );
    expect(gameResultsRepository.saveFinishedGame).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId,
        roomId: state.roomId,
        state,
        endReason: 'bankruptcy',
        winnerRoomPlayerId: 'room-player-1',
        durationSeconds: 45,
      }),
      tx,
    );
    expect(
      gameResultsRepository.saveFinishedGame.mock.calls[0][0].playerResults,
    ).toEqual([
      expect.objectContaining({
        roomPlayerId: 'room-player-1',
        finalCash: 1500,
        finalNetWorth: 1500,
        placement: 1,
        bankruptAt: null,
      }),
      expect.objectContaining({
        roomPlayerId: 'room-player-2',
        finalCash: 0,
        placement: 3,
        bankruptAt: new Date(46_000),
      }),
      expect.objectContaining({
        roomPlayerId: 'room-player-3',
        finalCash: 1500,
        finalNetWorth: 1500,
        placement: 2,
        bankruptAt: null,
      }),
    ]);
  });

  it('persists results after a game has expired', async () => {
    const { service, gameResultsRepository } = makeService();

    const state = makeFinishedState({
      startedAt: 1_000,
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-3') {
          return {
            ...player,
            cash: 2000,
          };
        }

        return player;
      }),
    });

    await service.finalizeFinishedGame({
      gameId,
      state,
      events: [
        {
          type: 'game_finished_by_time',
          finishedAt: 46_000,
          winnerRoomPlayerId: 'room-player-3',
          tiedRoomPlayerIds: ['room-player-3'],
          standings: [
            {
              roomPlayerId: 'room-player-3',
              seatNumber: 3,
              cash: 2000,
              ownedPropertyCount: 0,
              assetValue: 0,
              netWorth: 2000,
            },
          ],
        },
      ],
    });

    expect(gameResultsRepository.saveFinishedGame).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId,
        roomId: state.roomId,
        endReason: 'time_elapsed',
        winnerRoomPlayerId: 'room-player-3',
        completedAt: new Date(46_000),
        durationSeconds: 45,
      }),
      tx,
    );
  });

  it('breaks expired-game winner ties deterministically', async () => {
    const { service, gameResultsRepository } = makeService();

    const state = makeFinishedState({
      players: createGameEngineState().players.map((player) => ({
        ...player,
        cash: 1500,
      })),
    });

    await service.finalizeFinishedGame({
      gameId,
      state,
      events: [
        {
          type: 'game_finished_by_time',
          finishedAt: 46_000,
          winnerRoomPlayerId: null,
          tiedRoomPlayerIds: [
            'room-player-1',
            'room-player-2',
            'room-player-3',
          ],
          standings: [],
        },
      ],
    });

    expect(gameResultsRepository.saveFinishedGame).toHaveBeenCalledWith(
      expect.objectContaining({
        winnerRoomPlayerId: 'room-player-1',
      }),
      tx,
    );
  });

  it('creates the final snapshot and result rows in one transaction', async () => {
    const {
      service,
      databaseService,
      gameSnapshotService,
      gameResultsRepository,
      gameStatsService,
    } = makeService();

    const state = makeFinishedState();

    await service.finalizeFinishedGame({
      gameId,
      state,
      events: [
        {
          type: 'game_finished_by_time',
          finishedAt: 46_000,
          winnerRoomPlayerId: 'room-player-1',
          tiedRoomPlayerIds: ['room-player-1'],
          standings: [],
        },
      ],
    });

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);
    expect(gameSnapshotService.createFinalSnapshot).toHaveBeenCalledWith(
      gameId,
      state,
      tx,
    );
    expect(gameResultsRepository.saveFinishedGame).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId,
      }),
      tx,
    );
    expect(gameStatsService.applyFinishedGameStats).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: state.roomId,
        state,
        playerResults: expect.any(Array),
      }),
      tx,
    );
  });
});

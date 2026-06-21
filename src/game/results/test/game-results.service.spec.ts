import { NotFoundException } from '@nestjs/common';
import { GameResultsService } from '../game-results.service';
import type { GameEngineState } from '../../engine/game-engine.types';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import type { LeaderboardQueueService } from '../../../leaderboards/jobs/leaderboard-queue.service';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { UsersStatsService } from '../../../users/services/users-stats.service';
import type { SaveGameResultsInput } from '../game-results.types';

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
      transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
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

    const usersStatsService = {
      invalidateMatchHistoryCache: jest.fn(),
    };

    const service = new GameResultsService(
      gameResultsRepository as never,
      databaseService as never,
      gameSnapshotService as never,
      gameStatsService as never,
      leaderboardQueueService as unknown as LeaderboardQueueService,
      observabilityService as unknown as ObservabilityService,
      usersStatsService as unknown as UsersStatsService,
    );

    return {
      service,
      gameResultsRepository,
      databaseService,
      gameSnapshotService,
      gameStatsService,
      leaderboardQueueService,
      observabilityService,
      usersStatsService,
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
    const saveCalls = gameResultsRepository.saveFinishedGame.mock
      .calls as unknown[][];
    const saveInput = saveCalls[0]?.[0] as SaveGameResultsInput;

    expect(saveInput.playerResults).toEqual([
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

  it('assigns unique placements to bankrupt players from final net worth', async () => {
    const { service, gameResultsRepository } = makeService();
    const baseState = createGameEngineState();
    const state = makeFinishedState({
      players: [
        {
          ...baseState.players[0],
          cash: 1200,
        },
        {
          ...baseState.players[1],
          cash: 0,
          bankrupt: true,
        },
        {
          ...baseState.players[2],
          cash: 700,
        },
        {
          ...baseState.players[0],
          roomPlayerId: 'room-player-4',
          userId: 'user-4',
          username: 'playerfour',
          seatNumber: 4,
          cash: 0,
          bankrupt: true,
        },
      ],
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
              cash: 1200,
              ownedPropertyCount: 0,
              assetValue: 0,
              netWorth: 1200,
            },
          ],
        },
      ],
    });

    const saveCalls = gameResultsRepository.saveFinishedGame.mock
      .calls as unknown[][];
    const saveInput = saveCalls[0]?.[0] as SaveGameResultsInput;

    expect(
      saveInput.playerResults.map((playerResult) => ({
        roomPlayerId: playerResult.roomPlayerId,
        placement: playerResult.placement,
        finalNetWorth: playerResult.finalNetWorth,
      })),
    ).toEqual([
      { roomPlayerId: 'room-player-1', placement: 1, finalNetWorth: 1200 },
      { roomPlayerId: 'room-player-2', placement: 3, finalNetWorth: 0 },
      { roomPlayerId: 'room-player-3', placement: 2, finalNetWorth: 700 },
      { roomPlayerId: 'room-player-4', placement: 4, finalNetWorth: 0 },
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

  it('persists abandoned results when a bot wins without a user id', async () => {
    const { service, gameResultsRepository } = makeService();

    const state = makeFinishedState({
      players: createGameEngineState().players.map((player) => {
        if (player.roomPlayerId === 'room-player-2') {
          return {
            ...player,
            userId: null,
            username: null,
            playerType: 'bot' as const,
            botDifficulty: 'normal' as const,
            botName: 'Nova',
            cash: 2_000,
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
          type: 'game_finished_after_last_human_left',
          finishedAt: 46_000,
          winnerRoomPlayerId: 'room-player-2',
          tiedRoomPlayerIds: ['room-player-2'],
          standings: [
            {
              roomPlayerId: 'room-player-2',
              seatNumber: 2,
              cash: 2_000,
              ownedPropertyCount: 0,
              assetValue: 0,
              netWorth: 2_000,
            },
          ],
        },
      ],
    });

    expect(gameResultsRepository.saveFinishedGame).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId,
        roomId: state.roomId,
        endReason: 'abandoned',
        winnerRoomPlayerId: 'room-player-2',
      }),
      tx,
    );
    const saveCalls = gameResultsRepository.saveFinishedGame.mock
      .calls as unknown[][];
    const saveInput = saveCalls[0]?.[0] as SaveGameResultsInput;

    expect(saveInput.playerResults).toContainEqual(
      expect.objectContaining({
        roomPlayerId: 'room-player-2',
        userId: null,
        finalCash: 2_000,
        placement: 1,
      }),
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
    const statsCalls = gameStatsService.applyFinishedGameStats.mock
      .calls as unknown[][];
    const statsInput = statsCalls[0]?.[0] as {
      roomId: string;
      state: GameEngineState;
      playerResults: SaveGameResultsInput['playerResults'];
    };

    expect(statsInput).toMatchObject({
      roomId: state.roomId,
      state,
    });
    expect(Array.isArray(statsInput.playerResults)).toBe(true);
  });
});

import type { DatabaseExecutor } from '../../../infra/database/database.service';
import type { SaveRoomPlayerResultInput } from '../../results/game-results.types';
import { createGameEngineState } from '../../engine/tests/game-engine.test-factory';
import { GameRatingService } from '../game-rating.service';
import { GameStatsService } from '../game-stats.service';

describe('GameStatsService', () => {
  const tx = Symbol('tx') as unknown as DatabaseExecutor;

  const makePlayerResult = (
    overrides: Partial<SaveRoomPlayerResultInput>,
  ): SaveRoomPlayerResultInput => ({
    roomId: 'room-1',
    roomPlayerId: 'room-player-1',
    userId: 'user-1',
    seatNumber: 1,
    startingCash: 1500,
    finalCash: 2000,
    finalNetWorth: 2000,
    placement: 1,
    bankruptAt: null,
    ...overrides,
  });

  const makeStats = (overrides: Record<string, unknown> = {}) => ({
    userId: 'user-1',
    gamesPlayed: 5,
    firstPlace: 1,
    secondPlace: 2,
    thirdPlace: 2,
    fourthPlace: 0,
    avgPosition: '2.20',
    currentRating: 1200,
    peakRating: 1200,
    totalNetWorth: 10_000n,
    totalRentCollected: 0n,
    totalRentPaid: 0n,
    ...overrides,
  });

  const makeService = () => {
    const gameStatsRepository = {
      createMissingPlayerStats: jest.fn().mockResolvedValue(undefined),
      lockPlayerStats: jest
        .fn()
        .mockResolvedValue([
          makeStats({ userId: 'user-1' }),
          makeStats({ userId: 'user-2' }),
          makeStats({ userId: 'user-3' }),
        ]),
      recordRatingChange: jest.fn().mockResolvedValue(true),
      updatePlayerStats: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GameStatsService(
      gameStatsRepository as never,
      new GameRatingService(),
    );

    return {
      service,
      gameStatsRepository,
    };
  };

  it('updates ranked human stats and records rating changes', async () => {
    const { service, gameStatsRepository } = makeService();

    const state = createGameEngineState({
      mode: 'ranked',
    });

    const playerResults = [
      makePlayerResult({
        roomPlayerId: 'room-player-1',
        userId: 'user-1',
        seatNumber: 1,
        finalNetWorth: 2000,
        placement: 1,
      }),
      makePlayerResult({
        roomPlayerId: 'room-player-2',
        userId: 'user-2',
        seatNumber: 2,
        finalNetWorth: 1500,
        placement: 2,
      }),
      makePlayerResult({
        roomPlayerId: 'room-player-3',
        userId: 'user-3',
        seatNumber: 3,
        finalNetWorth: 1000,
        placement: 3,
      }),
    ];

    await service.applyFinishedGameStats(
      {
        roomId: state.roomId,
        state,
        playerResults,
      },
      tx,
    );

    expect(gameStatsRepository.createMissingPlayerStats).toHaveBeenCalledWith(
      ['user-1', 'user-2', 'user-3'],
      tx,
    );
    expect(gameStatsRepository.lockPlayerStats).toHaveBeenCalledWith(
      ['user-1', 'user-2', 'user-3'],
      tx,
    );
    expect(gameStatsRepository.recordRatingChange).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        roomId: state.roomId,
        ratingBefore: 1200,
        ratingAfter: 1216,
        ratingDelta: 16,
        placement: 1,
      },
      tx,
    );
    expect(gameStatsRepository.recordRatingChange).toHaveBeenCalledWith(
      {
        userId: 'user-3',
        roomId: state.roomId,
        ratingBefore: 1200,
        ratingAfter: 1184,
        ratingDelta: -16,
        placement: 3,
      },
      tx,
    );
    expect(gameStatsRepository.updatePlayerStats).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        gamesPlayed: 6,
        firstPlace: 2,
        avgPosition: 2,
        currentRating: 1216,
        peakRating: 1216,
        totalNetWorth: 12_000n,
      }),
      tx,
    );
  });

  it('skips casual games', async () => {
    const { service, gameStatsRepository } = makeService();

    await service.applyFinishedGameStats(
      {
        roomId: 'room-1',
        state: createGameEngineState({ mode: 'casual' }),
        playerResults: [],
      },
      tx,
    );

    expect(gameStatsRepository.createMissingPlayerStats).not.toHaveBeenCalled();
    expect(gameStatsRepository.recordRatingChange).not.toHaveBeenCalled();
    expect(gameStatsRepository.updatePlayerStats).not.toHaveBeenCalled();
  });

  it('does not apply stats unless every player is human-owned', async () => {
    const { service, gameStatsRepository } = makeService();

    await service.applyFinishedGameStats(
      {
        roomId: 'room-1',
        state: createGameEngineState({
          players: createGameEngineState().players.map((player) =>
            player.roomPlayerId === 'room-player-2'
              ? {
                  ...player,
                  userId: null,
                  playerType: 'bot',
                  botDifficulty: 'normal',
                  botName: 'Nova',
                }
              : player,
          ),
        }),
        playerResults: [],
      },
      tx,
    );

    expect(gameStatsRepository.createMissingPlayerStats).not.toHaveBeenCalled();
    expect(gameStatsRepository.recordRatingChange).not.toHaveBeenCalled();
    expect(gameStatsRepository.updatePlayerStats).not.toHaveBeenCalled();
  });

  it('does not update stats when rating change was already recorded', async () => {
    const { service, gameStatsRepository } = makeService();

    gameStatsRepository.recordRatingChange.mockResolvedValue(false);

    const state = createGameEngineState();

    await service.applyFinishedGameStats(
      {
        roomId: state.roomId,
        state,
        playerResults: [
          makePlayerResult({
            roomPlayerId: 'room-player-1',
            userId: 'user-1',
            placement: 1,
          }),
          makePlayerResult({
            roomPlayerId: 'room-player-2',
            userId: 'user-2',
            placement: 2,
          }),
          makePlayerResult({
            roomPlayerId: 'room-player-3',
            userId: 'user-3',
            placement: 3,
          }),
        ],
      },
      tx,
    );

    expect(gameStatsRepository.recordRatingChange).toHaveBeenCalledTimes(3);
    expect(gameStatsRepository.updatePlayerStats).not.toHaveBeenCalled();
  });
});

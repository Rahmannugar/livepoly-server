import { LEADERBOARD_PERIODS } from '../leaderboards.constants';
import { LeaderboardsService } from '../leaderboards.service';

describe('LeaderboardsService', () => {
  const snapshot = {
    period: LEADERBOARD_PERIODS.weekly,
    periodStart: new Date('2026-05-23T12:00:00.000Z'),
    periodEnd: new Date('2026-05-30T12:00:00.000Z'),
    entries: [
      {
        rank: 1,
        userId: 'user-1',
        username: 'playerone',
        avatarObjectKey: 'avatars/user-1/avatar.webp',
        rating: 560,
        gamesPlayed: 4,
        wins: 2,
        averagePlacement: 1.75,
      },
      {
        rank: 2,
        userId: 'user-2',
        username: 'playertwo',
        avatarObjectKey: null,
        rating: 530,
        gamesPlayed: 3,
        wins: 1,
        averagePlacement: 2.1,
      },
    ],
  };

  const makeService = () => {
    const leaderboardsRepository = {
      findLatestSnapshot: jest.fn().mockResolvedValue(snapshot),
      buildSnapshotEntries: jest.fn().mockResolvedValue(snapshot.entries),
      saveSnapshot: jest.fn().mockResolvedValue(undefined),
    };

    const redisClient = {
      get: jest.fn().mockResolvedValue('3'),
      incr: jest.fn().mockResolvedValue(4),
    };

    const cacheService = {
      getClient: jest.fn().mockReturnValue(redisClient),
      getOrSet: jest.fn(async ({ factory }) => factory()),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('https://pub-example.r2.dev'),
    };

    const service = new LeaderboardsService(
      leaderboardsRepository as never,
      cacheService as never,
      configService as never,
    );

    return {
      service,
      leaderboardsRepository,
      cacheService,
      redisClient,
      configService,
    };
  };

  it('returns latest leaderboard through versioned cache', async () => {
    const { service, leaderboardsRepository, cacheService } = makeService();

    await expect(
      service.getLeaderboard(LEADERBOARD_PERIODS.weekly),
    ).resolves.toEqual({
      period: 'weekly',
      periodStart: '2026-05-23T12:00:00.000Z',
      periodEnd: '2026-05-30T12:00:00.000Z',
      entries: [
        {
          rank: 1,
          userId: 'user-1',
          username: 'playerone',
          avatarUrl: 'https://pub-example.r2.dev/avatars/user-1/avatar.webp',
          rating: 560,
          gamesPlayed: 4,
          wins: 2,
          averagePlacement: 1.75,
        },
        {
          rank: 2,
          userId: 'user-2',
          username: 'playertwo',
          avatarUrl: null,
          rating: 530,
          gamesPlayed: 3,
          wins: 1,
          averagePlacement: 2.1,
        },
      ],
    });

    expect(cacheService.getOrSet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'leaderboards:v3:weekly',
        ttlSeconds: 60,
        ttlJitterRatio: 0.15,
      }),
    );
    expect(leaderboardsRepository.findLatestSnapshot).toHaveBeenCalledWith(
      'weekly',
    );
  });

  it('returns empty leaderboard when no snapshot exists', async () => {
    const { service, leaderboardsRepository } = makeService();

    leaderboardsRepository.findLatestSnapshot.mockResolvedValue(null);

    const result = await service.getLeaderboard(LEADERBOARD_PERIODS.monthly);

    expect(result).toMatchObject({
      period: 'monthly',
      entries: [],
    });
  });

  it('refreshes weekly snapshot with rolling seven-day window', async () => {
    const { service, leaderboardsRepository } = makeService();
    const now = new Date('2026-05-30T12:00:00.000Z');

    await expect(
      service.refreshPeriod(LEADERBOARD_PERIODS.weekly, now),
    ).resolves.toEqual({
      period: 'weekly',
      periodStart: new Date('2026-05-23T12:00:00.000Z'),
      periodEnd: now,
      entries: snapshot.entries,
    });

    expect(leaderboardsRepository.buildSnapshotEntries).toHaveBeenCalledWith({
      periodStart: new Date('2026-05-23T12:00:00.000Z'),
      periodEnd: now,
    });
    expect(leaderboardsRepository.saveSnapshot).toHaveBeenCalledWith({
      period: 'weekly',
      periodStart: new Date('2026-05-23T12:00:00.000Z'),
      periodEnd: now,
      entries: snapshot.entries,
    });
  });

  it('refreshes monthly snapshot with rolling thirty-day window', async () => {
    const { service, leaderboardsRepository } = makeService();
    const now = new Date('2026-05-30T12:00:00.000Z');

    await service.refreshPeriod(LEADERBOARD_PERIODS.monthly, now);

    expect(leaderboardsRepository.buildSnapshotEntries).toHaveBeenCalledWith({
      periodStart: new Date('2026-04-30T12:00:00.000Z'),
      periodEnd: now,
    });
  });

  it('bumps cache version for invalidation', async () => {
    const { service, redisClient } = makeService();

    await service.invalidateCache();

    expect(redisClient.incr).toHaveBeenCalledWith('leaderboards:version');
  });
});

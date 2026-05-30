import { Injectable } from '@nestjs/common';
import { CacheService } from '../infra/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import {
  LEADERBOARD_CACHE,
  LEADERBOARD_PERIODS,
  LEADERBOARD_WINDOWS,
} from './leaderboards.constants';
import { LeaderboardsRepository } from './leaderboards.repository';
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardSnapshot,
} from './leaderboards.types';

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly leaderboardsRepository: LeaderboardsRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async getLeaderboard(
    period: LeaderboardPeriod,
  ): Promise<LeaderboardResponse> {
    const version = await this.getCacheVersion();
    const cacheKey = this.cacheKey(period, version);

    return this.cacheService.getOrSet({
      key: cacheKey,
      ttlSeconds: LEADERBOARD_CACHE.ttlSeconds[period],
      ttlJitterRatio: LEADERBOARD_CACHE.ttlJitterRatio,
      factory: async () => {
        const snapshot =
          await this.leaderboardsRepository.findLatestSnapshot(period);

        if (!snapshot) {
          return this.emptyResponse(period);
        }

        return this.response(snapshot);
      },
    });
  }

  async refreshPeriod(
    period: LeaderboardPeriod,
    now = new Date(),
  ): Promise<LeaderboardSnapshot> {
    const periodEnd = now;
    const periodStart = new Date(
      periodEnd.getTime() - LEADERBOARD_WINDOWS[period],
    );

    const entries = await this.leaderboardsRepository.buildSnapshotEntries({
      periodStart,
      periodEnd,
    });

    const snapshot: LeaderboardSnapshot = {
      period,
      periodStart,
      periodEnd,
      entries,
    };

    await this.leaderboardsRepository.saveSnapshot(snapshot);

    return snapshot;
  }

  async refreshAll(now = new Date()): Promise<LeaderboardSnapshot[]> {
    return Promise.all([
      this.refreshPeriod(LEADERBOARD_PERIODS.weekly, now),
      this.refreshPeriod(LEADERBOARD_PERIODS.monthly, now),
    ]);
  }

  async invalidateCache(): Promise<void> {
    await this.cacheService.getClient().incr(LEADERBOARD_CACHE.versionKey);
  }

  async refreshSnapshots(): Promise<LeaderboardSnapshot[]> {
    const snapshots = await this.refreshAll();
    await this.invalidateCache();

    return snapshots;
  }

  private async getCacheVersion(): Promise<number> {
    const value = await this.cacheService
      .getClient()
      .get(LEADERBOARD_CACHE.versionKey);

    return value ? Number(value) : 1;
  }

  private cacheKey(period: LeaderboardPeriod, version: number): string {
    return `leaderboards:v${version}:${period}`;
  }

  private emptyResponse(period: LeaderboardPeriod): LeaderboardResponse {
    const now = new Date();

    return {
      period,
      periodStart: now.toISOString(),
      periodEnd: now.toISOString(),
      entries: [],
    };
  }

  private response(snapshot: LeaderboardSnapshot): LeaderboardResponse {
    return {
      period: snapshot.period,
      periodStart: snapshot.periodStart.toISOString(),
      periodEnd: snapshot.periodEnd.toISOString(),
      entries: snapshot.entries.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        username: entry.username,
        avatarUrl: this.resolveAvatarUrl(entry.avatarObjectKey),
        rating: entry.rating,
        gamesPlayed: entry.gamesPlayed,
        wins: entry.wins,
        averagePlacement: entry.averagePlacement,
      })),
    };
  }

  private resolveAvatarUrl(avatarObjectKey: string | null): string | null {
    if (!avatarObjectKey) {
      return null;
    }

    const baseUrl = this.configService.getOrThrow<string>('R2_PUBLIC_BASE_URL');

    return `${baseUrl.replace(/\/$/, '')}/${avatarObjectKey}`;
  }
}

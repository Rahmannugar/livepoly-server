import { Injectable } from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service';
import { GAME_PRESENCE } from '../game.constants';
import type { GameLiveAccess } from '../realtime/game-realtime.types';
import type {
  GamePresenceEntry,
  GamePresenceSummary,
} from './game-presence.types';

type TrackPresenceInput = {
  gameId: string;
  userId: string;
  socketId: string;
  access: GameLiveAccess;
};

@Injectable()
export class GamePresenceService {
  constructor(private readonly cacheService: CacheService) {}

  async track(input: TrackPresenceInput): Promise<void> {
    const redis = this.cacheService.getClient();

    await redis.set(
      this.socketPresenceKey(input),
      JSON.stringify({
        gameId: input.gameId,
        userId: input.userId,
        socketId: input.socketId,
        access: input.access,
        lastSeenAt: new Date().toISOString(),
      }),
      'EX',
      GAME_PRESENCE.ttlSeconds,
    );

    await redis.sadd(
      this.gamePresenceSocketsKey(input.gameId),
      this.gamePresenceMember(input),
    );
    await redis.expire(
      this.gamePresenceSocketsKey(input.gameId),
      GAME_PRESENCE.ttlSeconds,
    );
  }

  async remove(input: {
    gameId: string;
    userId: string;
    socketId: string;
  }): Promise<void> {
    const redis = this.cacheService.getClient();

    await redis.del(this.socketPresenceKey(input));
    await redis.srem(
      this.gamePresenceSocketsKey(input.gameId),
      this.gamePresenceMember(input),
    );
  }

  async getSummary(gameId: string): Promise<GamePresenceSummary> {
    const redis = this.cacheService.getClient();
    const members = await redis.smembers(this.gamePresenceSocketsKey(gameId));

    if (members.length === 0) {
      return {
        gameId,
        onlineUsers: [],
        playersOnline: 0,
        spectatorsOnline: 0,
      };
    }

    const entries = await Promise.all(
      members.map(async (member) => {
        const [userId, socketId] = member.split(':');

        if (!userId || !socketId) {
          await redis.srem(this.gamePresenceSocketsKey(gameId), member);
          return null;
        }

        const value = await redis.get(
          this.socketPresenceKey({ gameId, userId, socketId }),
        );

        if (!value) {
          await redis.srem(this.gamePresenceSocketsKey(gameId), member);
          return null;
        }

        return JSON.parse(value) as GamePresenceEntry;
      }),
    );

    const byUserId = new Map<
      string,
      {
        userId: string;
        access: GameLiveAccess;
        socketCount: number;
        lastSeenAt: string;
      }
    >();

    for (const entry of entries) {
      if (!entry) {
        continue;
      }

      const current = byUserId.get(entry.userId);

      if (!current) {
        byUserId.set(entry.userId, {
          userId: entry.userId,
          access: entry.access,
          socketCount: 1,
          lastSeenAt: entry.lastSeenAt,
        });
        continue;
      }

      current.socketCount += 1;

      if (entry.lastSeenAt > current.lastSeenAt) {
        current.lastSeenAt = entry.lastSeenAt;
      }

      if (entry.access === 'player') {
        current.access = entry.access;
      }
    }

    const onlineUsers = [...byUserId.values()].sort((a, b) =>
      a.userId.localeCompare(b.userId),
    );

    return {
      gameId,
      onlineUsers,
      playersOnline: onlineUsers.filter((user) => user.access === 'player')
        .length,
      spectatorsOnline: onlineUsers.filter(
        (user) => user.access === 'spectator',
      ).length,
    };
  }

  private socketPresenceKey(input: {
    gameId: string;
    userId: string;
    socketId: string;
  }): string {
    return `game:${input.gameId}:presence:${input.userId}:${input.socketId}`;
  }

  private gamePresenceSocketsKey(gameId: string): string {
    return `game:${gameId}:presence:sockets`;
  }

  private gamePresenceMember(input: {
    userId: string;
    socketId: string;
  }): string {
    return `${input.userId}:${input.socketId}`;
  }
}

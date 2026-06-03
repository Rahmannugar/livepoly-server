import { Injectable } from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service';
import { GAME_PRESENCE } from '../game.constants';
import type { GameLiveAccess } from '../realtime/game-realtime.types';

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

    await redis.sadd(this.gamePresenceSocketsKey(input.gameId), input.socketId);
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
    await redis.srem(this.gamePresenceSocketsKey(input.gameId), input.socketId);
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
}

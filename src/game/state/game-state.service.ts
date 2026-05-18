import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { CacheService } from '../../infra/cache/cache.service';
import type { GameEngineState } from '../engine/game-engine.types';
import type {
  GameStateUpdateOptions,
  GameStateUpdater,
} from './game-state.types';

const GAME_STATE_TTL_SECONDS = 24 * 60 * 60;
const GAME_STATE_UPDATE_MAX_ATTEMPTS = 5;
const GAME_STATE_UPDATE_RETRY_DELAY_MS = 25;

const COMPARE_AND_SET_STATE_SCRIPT = `
local current = redis.call("GET", KEYS[1])

if current == false then
  return -1
end

if current ~= ARGV[1] then
  return 0
end

redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])

return 1
`;

@Injectable()
export class GameStateService {
  constructor(private readonly cacheService: CacheService) {}

  async get(gameId: string): Promise<GameEngineState> {
    const state = await this.redis.get(this.stateKey(gameId));

    if (!state) {
      throw new NotFoundException('Game state not found');
    }

    return this.parseState(state);
  }

  async set(gameId: string, state: GameEngineState): Promise<void> {
    await this.redis.set(
      this.stateKey(gameId),
      JSON.stringify(state),
      'EX',
      GAME_STATE_TTL_SECONDS,
    );
  }

  async update(
    gameId: string,
    updater: GameStateUpdater,
    options: GameStateUpdateOptions = {},
  ): Promise<GameEngineState> {
    const maxAttempts = options.maxAttempts ?? GAME_STATE_UPDATE_MAX_ATTEMPTS;
    const retryDelayMs =
      options.retryDelayMs ?? GAME_STATE_UPDATE_RETRY_DELAY_MS;
    const key = this.stateKey(gameId);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const currentSerialized = await this.redis.get(key);

      if (!currentSerialized) {
        throw new NotFoundException('Game state not found');
      }

      const currentState = this.parseState(currentSerialized);
      const nextState = await updater(currentState);
      const nextSerialized = JSON.stringify(nextState);

      const result = await this.redis.eval(
        COMPARE_AND_SET_STATE_SCRIPT,
        1,
        key,
        currentSerialized,
        nextSerialized,
        GAME_STATE_TTL_SECONDS,
      );

      if (result === 1) {
        return nextState;
      }

      if (result === -1) {
        throw new NotFoundException('Game state not found');
      }

      await this.sleep(retryDelayMs);
    }

    throw new ConflictException('Game is processing another action');
  }

  async delete(gameId: string): Promise<void> {
    await this.redis.del(this.stateKey(gameId));
  }

  private parseState(value: string): GameEngineState {
    try {
      return JSON.parse(value) as GameEngineState;
    } catch {
      throw new InternalServerErrorException('Game state is corrupted');
    }
  }

  private stateKey(gameId: string): string {
    return `game:${gameId}:state`;
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private get redis(): Redis {
    return this.cacheService.getClient();
  }
}

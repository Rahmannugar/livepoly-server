import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { CacheService } from '../../infra/cache/cache.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GAME_EVENTS, GAME_METRICS, GAME_STATE } from '../game.constants';
import type { GameEngineState } from '../engine/game-engine.types';
import type {
  GameStateUpdateOptions,
  GameStateUpdater,
} from './game-state.types';

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
  constructor(
    private readonly cacheService: CacheService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async get(gameId: string): Promise<GameEngineState> {
    const state = await this.redis.get(this.stateKey(gameId));

    if (!state) {
      this.recordStateMissing(gameId);
      throw new NotFoundException('Game state not found');
    }

    return this.parseState(gameId, state);
  }

  async set(gameId: string, state: GameEngineState): Promise<void> {
    await this.redis.set(
      this.stateKey(gameId),
      JSON.stringify(state),
      'EX',
      GAME_STATE.ttlSeconds,
    );

    this.observabilityService.recordEvent(GAME_EVENTS.stateSaved, {
      gameId,
      mode: state.mode,
      phase: state.phase,
      turnNumber: state.turnNumber,
    });
    this.observabilityService.recordMetric(GAME_METRICS.stateSaved);
  }

  async update(
    gameId: string,
    updater: GameStateUpdater,
    options: GameStateUpdateOptions = {},
  ): Promise<GameEngineState> {
    const maxAttempts = options.maxAttempts ?? GAME_STATE.updateMaxAttempts;
    const retryDelayMs = options.retryDelayMs ?? GAME_STATE.updateRetryDelayMs;
    const key = this.stateKey(gameId);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const currentSerialized = await this.redis.get(key);

      if (!currentSerialized) {
        this.recordStateMissing(gameId, attempt, maxAttempts);
        throw new NotFoundException('Game state not found');
      }

      const currentState = this.parseState(gameId, currentSerialized);
      const nextState = await updater(currentState);
      const nextSerialized = JSON.stringify(nextState);

      const result = await this.redis.eval(
        COMPARE_AND_SET_STATE_SCRIPT,
        1,
        key,
        currentSerialized,
        nextSerialized,
        GAME_STATE.ttlSeconds,
      );

      if (result === 1) {
        this.observabilityService.recordEvent(GAME_EVENTS.stateUpdated, {
          gameId,
          mode: nextState.mode,
          phase: nextState.phase,
          turnNumber: nextState.turnNumber,
          attempt,
        });
        this.observabilityService.recordMetric(GAME_METRICS.stateUpdated);

        return nextState;
      }

      if (result === -1) {
        this.recordStateMissing(gameId, attempt, maxAttempts);
        throw new NotFoundException('Game state not found');
      }

      this.observabilityService.recordEvent(GAME_EVENTS.stateCasRetry, {
        gameId,
        attempt,
        maxAttempts,
      });
      this.observabilityService.recordMetric(GAME_METRICS.stateCasRetry);

      await this.sleep(retryDelayMs);
    }

    this.observabilityService.recordEvent(GAME_EVENTS.stateCasConflict, {
      gameId,
      maxAttempts,
    });
    this.observabilityService.recordMetric(GAME_METRICS.stateCasConflict);

    throw new ConflictException('Game is processing another action');
  }

  async delete(gameId: string): Promise<void> {
    await this.redis.del(this.stateKey(gameId));

    this.observabilityService.recordEvent(GAME_EVENTS.stateDeleted, {
      gameId,
    });
    this.observabilityService.recordMetric(GAME_METRICS.stateDeleted);
  }

  private parseState(gameId: string, value: string): GameEngineState {
    try {
      return JSON.parse(value) as GameEngineState;
    } catch {
      this.observabilityService.recordEvent(GAME_EVENTS.stateCorrupted, {
        gameId,
      });
      this.observabilityService.recordMetric(GAME_METRICS.stateCorrupted);

      throw new InternalServerErrorException('Game state is corrupted');
    }
  }

  private recordStateMissing(
    gameId: string,
    attempt?: number,
    maxAttempts?: number,
  ): void {
    this.observabilityService.recordEvent(GAME_EVENTS.stateMissing, {
      gameId,
      attempt,
      maxAttempts,
    });
    this.observabilityService.recordMetric(GAME_METRICS.stateMissing);
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

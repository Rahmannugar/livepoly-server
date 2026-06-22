import { Injectable } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { RealtimeEmitterService } from '../../infra/realtime/realtime-emitter.service';
import type { GameCommandResult } from '../commands/game-commands.types';
import {
  GAME_EVENTS,
  GAME_METRICS,
  GAME_SOCKET_EVENTS,
} from '../game.constants';
import type { GameEventsEvent, GameStateEvent } from './game-realtime.types';

const GAME_SOCKET_NAMESPACE = '/game';

@Injectable()
export class GameRealtimePublisher {
  constructor(
    private readonly realtimeEmitterService: RealtimeEmitterService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  publishCommandResult(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    const room = this.gameRoom(gameId);

    this.realtimeEmitterService.emitToRoom(
      GAME_SOCKET_NAMESPACE,
      room,
      GAME_SOCKET_EVENTS.state,
      {
        gameId,
        state: result.state,
      } satisfies GameStateEvent,
    );

    if (result.events.length > 0) {
      this.realtimeEmitterService.emitToRoom(
        GAME_SOCKET_NAMESPACE,
        room,
        GAME_SOCKET_EVENTS.events,
        {
          gameId,
          events: result.events,
          emittedAt: new Date().toISOString(),
        } satisfies GameEventsEvent,
      );
    }

    this.observabilityService.recordEvent(GAME_EVENTS.realtimePublished, {
      gameId,
      phase: result.state.phase,
      turnNumber: result.state.turnNumber,
      eventCount: result.events.length,
    });

    this.observabilityService.recordMetric(GAME_METRICS.realtimePublished);

    return Promise.resolve();
  }

  private gameRoom(gameId: string): string {
    return `game:${gameId}`;
  }
}

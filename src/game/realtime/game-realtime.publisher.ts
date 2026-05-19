import { Injectable } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { PubSubService } from '../../infra/pubsub/pubsub.service';
import type { PubSubPayload } from '../../infra/pubsub/pubsub.types';
import type { GameCommandResult } from '../commands/game-commands.types';
import { GAME_EVENTS, GAME_METRICS, GAME_REALTIME } from '../game.constants';
import type { GameRealtimePubSubMessage } from './game-realtime.types';

@Injectable()
export class GameRealtimePublisher {
  constructor(
    private readonly pubSubService: PubSubService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async publishCommandResult(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    const message: GameRealtimePubSubMessage = {
      type: 'game_command_result',
      gameId,
      state: result.state,
      events: result.events,
    };

    await this.pubSubService.publish(
      GAME_REALTIME.channel,
      message as unknown as PubSubPayload,
    );

    this.observabilityService.recordEvent(GAME_EVENTS.realtimePublished, {
      gameId,
      phase: result.state.phase,
      turnNumber: result.state.turnNumber,
      eventCount: result.events.length,
    });

    this.observabilityService.recordMetric(GAME_METRICS.realtimePublished);
  }
}

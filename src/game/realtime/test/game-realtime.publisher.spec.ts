import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { PubSubService } from '../../../infra/pubsub/pubsub.service';
import type { GameCommandResult } from '../../commands/game-commands.types';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GAME_EVENTS, GAME_METRICS, GAME_REALTIME } from '../../game.constants';
import { GameRealtimePublisher } from '../game-realtime.publisher';

type PubSubServiceMock = {
  publish: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameRealtimePublisher', () => {
  let publisher: GameRealtimePublisher;
  let pubSubService: PubSubServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const state: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_turn_end',
    turnNumber: 2,
    currentTurnRoomPlayerId: 'room-player-1',
    consecutiveDoublesCount: 0,
    shouldCurrentPlayerPlayAgain: false,
    lastDiceRoll: [3, 4],
    pendingTileKey: null,
    auction: null,
    debt: null,
    decks: {
      chance: {
        drawPile: [],
        discardPile: [],
      },
      worldFund: {
        drawPile: [],
        discardPile: [],
      },
    },
    players: [],
    properties: [],
  };

  const result: GameCommandResult = {
    state,
    events: [
      {
        type: 'player_moved',
        roomPlayerId: 'room-player-1',
        fromPosition: 0,
        toPosition: 7,
        dice: [3, 4],
      },
    ],
    intentType: 'roll_and_move',
  };

  beforeEach(() => {
    pubSubService = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    publisher = new GameRealtimePublisher(
      pubSubService as unknown as PubSubService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('publishes command result to the shared realtime channel', async () => {
    await publisher.publishCommandResult('game-1', result);

    expect(pubSubService.publish).toHaveBeenCalledWith(GAME_REALTIME.channel, {
      type: 'game_command_result',
      gameId: 'game-1',
      state,
      events: result.events,
    });
  });

  it('records realtime publish telemetry', async () => {
    await publisher.publishCommandResult('game-1', result);

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.realtimePublished,
      {
        gameId: 'game-1',
        phase: state.phase,
        turnNumber: state.turnNumber,
        eventCount: result.events.length,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      GAME_METRICS.realtimePublished,
    );
  });
});

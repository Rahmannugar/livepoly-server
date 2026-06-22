import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { RealtimeEmitterService } from '../../../infra/realtime/realtime-emitter.service';
import type { GameCommandResult } from '../../commands/game-commands.types';
import type { GameEngineState } from '../../engine/game-engine.types';
import { GAME_SOCKET_EVENTS } from '../../game.constants';
import { GameRealtimePublisher } from '../game-realtime.publisher';

type RealtimeEmitterServiceMock = {
  emitToRoom: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameRealtimePublisher', () => {
  let publisher: GameRealtimePublisher;
  let realtimeEmitterService: RealtimeEmitterServiceMock;
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
    realtimeEmitterService = {
      emitToRoom: jest.fn(),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    publisher = new GameRealtimePublisher(
      realtimeEmitterService as unknown as RealtimeEmitterService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('emits state and events to the game socket room', async () => {
    await publisher.publishCommandResult('game-1', result);

    expect(realtimeEmitterService.emitToRoom).toHaveBeenCalledWith(
      '/game',
      'game:game-1',
      GAME_SOCKET_EVENTS.state,
      {
        gameId: 'game-1',
        state,
      },
    );
    expect(realtimeEmitterService.emitToRoom).toHaveBeenCalledWith(
      '/game',
      'game:game-1',
      GAME_SOCKET_EVENTS.events,
      {
        gameId: 'game-1',
        events: result.events,
        emittedAt: expect.any(String) as string,
      },
    );
  });

  it('does not emit events when there are no events', async () => {
    await publisher.publishCommandResult('game-1', {
      ...result,
      events: [],
    });

    expect(realtimeEmitterService.emitToRoom).toHaveBeenCalledTimes(1);
    expect(realtimeEmitterService.emitToRoom).toHaveBeenCalledWith(
      '/game',
      'game:game-1',
      GAME_SOCKET_EVENTS.state,
      {
        gameId: 'game-1',
        state,
      },
    );
  });
});

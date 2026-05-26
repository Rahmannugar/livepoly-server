import { ForbiddenException } from '@nestjs/common';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import type { GameCommandResult } from '../../commands/game-commands.types';
import type { GameTurnTimerQueueService } from '../../timers/game-turn-timer-queue.service';
import type { GameAccessRepository } from '../game-access.repository';
import type { GameRealtimePublisher } from '../game-realtime.publisher';
import { GameRealtimeService } from '../game-realtime.service';
import type { GameEngineState } from '../../engine/game-engine.types';

type GameAccessRepositoryMock = {
  findActivePlayerForGame: jest.Mock;
};

type GameCommandsServiceMock = {
  rollAndMove: jest.Mock;
  endTurn: jest.Mock;
};

type GameRealtimePublisherMock = {
  publishCommandResult: jest.Mock;
};

type GameBotQueueServiceMock = {
  enqueueIfBotCanAct: jest.Mock;
};

type GameTurnTimerQueueServiceMock = {
  enqueueTurnTimer: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameRealtimeService', () => {
  let service: GameRealtimeService;
  let gameAccessRepository: GameAccessRepositoryMock;
  let gameCommandsService: GameCommandsServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let observabilityService: ObservabilityServiceMock;

  const playerAccess = {
    gameId: 'game-1',
    roomId: 'room-1',
    roomPlayerId: 'room-player-1',
    userId: 'user-1',
  };

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

  const commandResult: GameCommandResult = {
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
    gameAccessRepository = {
      findActivePlayerForGame: jest.fn().mockResolvedValue(playerAccess),
    };

    gameCommandsService = {
      rollAndMove: jest.fn().mockResolvedValue(commandResult),
      endTurn: jest.fn().mockResolvedValue({
        ...commandResult,
        intentType: 'end_turn',
      }),
    };

    gameRealtimePublisher = {
      publishCommandResult: jest.fn().mockResolvedValue(undefined),
    };

    gameBotQueueService = {
      enqueueIfBotCanAct: jest.fn().mockResolvedValue(undefined),
    };

    gameTurnTimerQueueService = {
      enqueueTurnTimer: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameRealtimeService(
      gameAccessRepository as unknown as GameAccessRepository,
      gameCommandsService as unknown as GameCommandsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('rejects users who are not active game players', async () => {
    gameAccessRepository.findActivePlayerForGame.mockResolvedValue(null);

    await expect(
      service.joinGame({
        gameId: 'game-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(gameCommandsService.rollAndMove).not.toHaveBeenCalled();
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
  });

  it('rolls for the active room player and schedules follow-up work', async () => {
    const result = await service.rollAndMove({
      gameId: 'game-1',
      userId: 'user-1',
      dice: [3, 4],
    });

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      'user-1',
    );
    expect(gameCommandsService.rollAndMove).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
      dice: [3, 4],
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      commandResult,
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      state,
    );
    expect(result).toEqual(commandResult);
  });

  it('returns the command result when follow-up work fails', async () => {
    gameRealtimePublisher.publishCommandResult.mockRejectedValue(
      new Error('realtime down'),
    );
    gameBotQueueService.enqueueIfBotCanAct.mockRejectedValue(
      new Error('bot queue down'),
    );
    gameTurnTimerQueueService.enqueueTurnTimer.mockRejectedValue(
      new Error('timer queue down'),
    );

    const result = await service.rollAndMove({
      gameId: 'game-1',
      userId: 'user-1',
      dice: [3, 4],
    });

    expect(result).toEqual(commandResult);
  });
});

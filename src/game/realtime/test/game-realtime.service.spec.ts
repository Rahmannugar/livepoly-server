import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthRepository } from '../../../auth/auth.repository';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import type { GameCommandResult } from '../../commands/game-commands.types';
import type { GameEngineState } from '../../engine/game-engine.types';
import type { GameEventsService } from '../../events/game-events.service';
import type { GameRecoveryService } from '../../recovery/game-recovery.service';
import type { GameTurnTimerQueueService } from '../../timers/game-turn-timer-queue.service';
import type { GameAccessRepository } from '../game-access.repository';
import type { GameRealtimePublisher } from '../game-realtime.publisher';
import { GameRealtimeService } from '../game-realtime.service';
import { GAME_LIVE_ACCESS } from '../game-realtime.types';

type GameAccessRepositoryMock = {
  findActivePlayerForGame: jest.Mock;
  findCurrentSpectatorForGame: jest.Mock;
};

type AuthRepositoryMock = {
  findUserByIdForAuthToken: jest.Mock;
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

type GameEventsServiceMock = {
  listEvents: jest.Mock;
};

type GameRecoveryServiceMock = {
  getOrRecover: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

describe('GameRealtimeService', () => {
  let service: GameRealtimeService;
  let authRepository: AuthRepositoryMock;
  let gameAccessRepository: GameAccessRepositoryMock;
  let gameCommandsService: GameCommandsServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let gameEventsService: GameEventsServiceMock;
  let gameRecoveryService: GameRecoveryServiceMock;
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

  const recoveredEvents = {
    items: [
      {
        sequence: 1,
        type: 'player_moved',
        payload: commandResult.events[0],
        createdAt: '2026-05-14T12:00:00.000Z',
      },
    ],
    nextCursor: 'cursor-1',
    hasMore: false,
  };

  beforeEach(() => {
    authRepository = {
      findUserByIdForAuthToken: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'player@example.com',
        username: 'playerone',
        emailVerified: true,
        role: 'player',
        status: 'active',
        tokenVersion: 1,
        deletedAt: null,
      }),
    };

    gameAccessRepository = {
      findActivePlayerForGame: jest.fn().mockResolvedValue(playerAccess),
      findCurrentSpectatorForGame: jest.fn().mockResolvedValue(null),
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

    gameEventsService = {
      listEvents: jest.fn().mockResolvedValue(recoveredEvents),
    };

    gameRecoveryService = {
      getOrRecover: jest.fn().mockResolvedValue(state),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new GameRealtimeService(
      authRepository as unknown as AuthRepository,
      gameAccessRepository as unknown as GameAccessRepository,
      gameCommandsService as unknown as GameCommandsService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      gameEventsService as unknown as GameEventsService,
      gameRecoveryService as unknown as GameRecoveryService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('rejects already-connected suspended user before live game access', async () => {
    authRepository.findUserByIdForAuthToken.mockResolvedValue({
      id: 'user-1',
      email: 'player@example.com',
      username: 'playerone',
      emailVerified: true,
      role: 'player',
      status: 'suspended',
      tokenVersion: 1,
      deletedAt: null,
    });

    await expect(
      service.joinGame({
        gameId: 'game-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(gameAccessRepository.findActivePlayerForGame).not.toHaveBeenCalled();
    expect(gameCommandsService.rollAndMove).not.toHaveBeenCalled();
  });

  it('allows current spectator to join live game', async () => {
    gameAccessRepository.findActivePlayerForGame.mockResolvedValue(null);
    gameAccessRepository.findCurrentSpectatorForGame.mockResolvedValue({
      gameId: 'game-1',
      roomId: 'room-1',
      spectatorId: 'spectator-1',
      userId: 'user-1',
    });

    await expect(
      service.joinGame({
        gameId: 'game-1',
        userId: 'user-1',
      }),
    ).resolves.toEqual({
      access: GAME_LIVE_ACCESS.spectator,
      spectatorId: 'spectator-1',
      state,
    });

    expect(gameRecoveryService.getOrRecover).toHaveBeenCalledWith('game-1');
    expect(gameCommandsService.rollAndMove).not.toHaveBeenCalled();
  });

  it('rejects users who are not active game players or spectators', async () => {
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

  it('recovers events for a user with live game access', async () => {
    const result = await service.recoverEvents({
      gameId: 'game-1',
      userId: 'user-1',
      cursor: 'cursor-0',
    });

    expect(gameEventsService.listEvents).toHaveBeenCalledWith({
      gameId: 'game-1',
      cursor: 'cursor-0',
    });
    expect(result).toEqual(recoveredEvents);
  });

  it('rejects event recovery without live game access', async () => {
    gameAccessRepository.findActivePlayerForGame.mockResolvedValue(null);
    gameAccessRepository.findCurrentSpectatorForGame.mockResolvedValue(null);

    await expect(
      service.recoverEvents({
        gameId: 'game-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(gameEventsService.listEvents).not.toHaveBeenCalled();
  });

  it('rejects spectator gameplay command', async () => {
    gameAccessRepository.findActivePlayerForGame.mockResolvedValue(null);
    gameAccessRepository.findCurrentSpectatorForGame.mockResolvedValue({
      gameId: 'game-1',
      roomId: 'room-1',
      spectatorId: 'spectator-1',
      userId: 'user-1',
    });

    await expect(
      service.rollAndMove({
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
    });

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      'user-1',
    );
    const commandInput = gameCommandsService.rollAndMove.mock.calls[0][0];
    expect(commandInput.gameId).toBe('game-1');
    expect(commandInput.roomPlayerId).toBe('room-player-1');
    expect(commandInput.dice).toHaveLength(2);
    expect(commandInput.dice[0]).toBeGreaterThanOrEqual(1);
    expect(commandInput.dice[0]).toBeLessThanOrEqual(6);
    expect(commandInput.dice[1]).toBeGreaterThanOrEqual(1);
    expect(commandInput.dice[1]).toBeLessThanOrEqual(6);
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

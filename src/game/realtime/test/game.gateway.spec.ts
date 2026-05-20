import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { AuthRepository } from '../../../auth/auth.repository';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { PubSubService } from '../../../infra/pubsub/pubsub.service';
import type {
  PubSubMessageHandler,
  PubSubPayload,
  PubSubSubscription,
} from '../../../infra/pubsub/pubsub.types';
import type { GameBotQueueService } from '../../bots/game-bot-queue.service';
import type { GameCommandsService } from '../../commands/game-commands.service';
import {
  GameEngineError,
  type GameEngineEvent,
  type GameEngineState,
} from '../../engine/game-engine.types';
import { GAME_REALTIME, GAME_SOCKET_EVENTS } from '../../game.constants';
import type { GameTurnTimerQueueService } from '../../timers/game-turn-timer-queue.service';
import type { GameAccessRepository } from '../game-access.repository';
import type { GameRealtimePublisher } from '../game-realtime.publisher';
import type { AuthenticatedGameSocket } from '../game-realtime.types';
import { GameGateway } from '../game.gateway';

type GameCommandsServiceMock = {
  rollAndMove: jest.Mock;
  endTurn: jest.Mock;
};

type JwtServiceMock = {
  verifyAsync: jest.Mock;
};

type ConfigServiceMock = {
  getOrThrow: jest.Mock;
};

type AuthRepositoryMock = {
  findUserByIdForAuthToken: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

type GameAccessRepositoryMock = {
  findActivePlayerForGame: jest.Mock;
};

type PubSubServiceMock = {
  subscribe: jest.Mock;
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

type ServerMock = {
  to: jest.Mock;
};

type GameSocketMock = AuthenticatedGameSocket & {
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameCommandsService: GameCommandsServiceMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;
  let authRepository: AuthRepositoryMock;
  let observabilityService: ObservabilityServiceMock;
  let gameAccessRepository: GameAccessRepositoryMock;
  let pubSubService: PubSubServiceMock;
  let gameRealtimePublisher: GameRealtimePublisherMock;
  let gameBotQueueService: GameBotQueueServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let server: ServerMock;
  let roomEmitter: { emit: jest.Mock };
  let pubSubHandler: PubSubMessageHandler;
  let pubSubSubscription: PubSubSubscription;

  const authUser = {
    id: 'user-1',
    email: 'player@example.com',
    username: 'playerone',
    sessionId: 'session-1',
    tokenVersion: 1,
  };

  const authUserRecord = {
    id: authUser.id,
    email: authUser.email,
    username: authUser.username,
    emailVerified: true,
    deletedAt: null,
    tokenVersion: authUser.tokenVersion,
  };

  const tokenPayload = {
    sub: authUser.id,
    sid: authUser.sessionId,
    tv: authUser.tokenVersion,
    email: authUser.email,
    username: authUser.username,
  };

  const playerAccess = {
    gameId: 'game-1',
    roomId: 'room-1',
    roomPlayerId: 'room-player-1',
    userId: authUser.id,
  };

  const gameState: GameEngineState = {
    version: 1,
    roomId: 'room-1',
    roomCode: 'ABC12345',
    boardKey: 'classic',
    mode: 'ranked',
    phase: 'awaiting_roll',
    turnNumber: 1,
    currentTurnRoomPlayerId: 'room-player-1',
    consecutiveDoublesCount: 0,
    shouldCurrentPlayerPlayAgain: false,
    lastDiceRoll: null,
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

  const engineEvents: GameEngineEvent[] = [
    {
      type: 'player_moved',
      roomPlayerId: 'room-player-1',
      fromPosition: 0,
      toPosition: 7,
      dice: [3, 4],
    },
  ];

  const commandResult = {
    state: gameState,
    events: engineEvents,
    intentType: 'roll_and_move' as const,
  };

  const makeSocket = (token: string | null = 'access-token'): GameSocketMock =>
    ({
      id: 'socket-1',
      data: {},
      handshake: {
        auth: token ? { token } : {},
        headers: {},
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as GameSocketMock;

  beforeEach(() => {
    gameCommandsService = {
      rollAndMove: jest.fn(),
      endTurn: jest.fn(),
    };

    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue(tokenPayload),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('access-secret'),
    };

    authRepository = {
      findUserByIdForAuthToken: jest.fn().mockResolvedValue(authUserRecord),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    gameAccessRepository = {
      findActivePlayerForGame: jest.fn().mockResolvedValue(playerAccess),
    };

    pubSubSubscription = {
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };

    pubSubService = {
      subscribe: jest
        .fn()
        .mockImplementation(
          async (_channel: string, handler: PubSubMessageHandler) => {
            pubSubHandler = handler;
            return pubSubSubscription;
          },
        ),
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

    roomEmitter = {
      emit: jest.fn(),
    };

    server = {
      to: jest.fn().mockReturnValue(roomEmitter),
    };

    gateway = new GameGateway(
      gameCommandsService as unknown as GameCommandsService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      authRepository as unknown as AuthRepository,
      observabilityService as unknown as ObservabilityService,
      gameAccessRepository as unknown as GameAccessRepository,
      pubSubService as unknown as PubSubService,
      gameRealtimePublisher as unknown as GameRealtimePublisher,
      gameBotQueueService as unknown as GameBotQueueService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
    );

    Object.defineProperty(gateway, 'server', {
      value: server,
    });
  });

  it('subscribes to realtime updates on startup', async () => {
    await gateway.onModuleInit();

    expect(pubSubService.subscribe).toHaveBeenCalledWith(
      GAME_REALTIME.channel,
      expect.any(Function),
    );
  });

  it('unsubscribes from realtime updates on shutdown', async () => {
    await gateway.onModuleInit();
    await gateway.onModuleDestroy();

    expect(pubSubSubscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('emits realtime updates to the game socket room', async () => {
    await gateway.onModuleInit();

    pubSubHandler({
      type: 'game_command_result',
      gameId: 'game-1',
      state: gameState,
      events: engineEvents,
    } satisfies PubSubPayload);

    expect(server.to).toHaveBeenCalledWith('game:game-1');
    expect(roomEmitter.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.state, {
      gameId: 'game-1',
      state: gameState,
    });
    expect(roomEmitter.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.events, {
      gameId: 'game-1',
      events: engineEvents,
    });
  });

  it('ignores malformed realtime messages', async () => {
    await gateway.onModuleInit();

    pubSubHandler({
      type: 'unknown',
      gameId: 'game-1',
    });

    expect(server.to).not.toHaveBeenCalled();
    expect(roomEmitter.emit).not.toHaveBeenCalled();
  });

  it('disconnects unauthenticated sockets', async () => {
    const socket = makeSocket(null);

    await gateway.handleConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.error, {
      message: 'Authentication required',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.user).toBeUndefined();
  });

  it('authenticates sockets with a valid token', async () => {
    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(authRepository.findUserByIdForAuthToken).toHaveBeenCalledWith(
      authUser.id,
    );
    expect(socket.data.user).toEqual(authUser);
  });

  it('rejects game join without active player access', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameAccessRepository.findActivePlayerForGame.mockResolvedValue(null);

    await expect(
      gateway.joinGame(socket, {
        gameId: 'game-1',
      }),
    ).rejects.toThrow(WsException);

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      authUser.id,
    );
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('joins the game room with active player access', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;

    const result = await gateway.joinGame(socket, {
      gameId: 'game-1',
    });

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      authUser.id,
    );
    expect(socket.join).toHaveBeenCalledWith('game:game-1');
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.joined,
      data: {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
      },
    });
  });

  it('rolls for the authenticated room player', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.rollAndMove.mockResolvedValue(commandResult);

    const result = await gateway.rollAndMove(socket, {
      gameId: 'game-1',
      dice: [3, 4],
    });

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      authUser.id,
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
      gameState,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
    expect(server.to).not.toHaveBeenCalled();
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
        events: engineEvents,
      },
    });
  });

  it('ends turn for the authenticated room player', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.endTurn.mockResolvedValue({
      ...commandResult,
      intentType: 'end_turn',
    });

    const result = await gateway.endTurn(socket, {
      gameId: 'game-1',
    });

    expect(gameAccessRepository.findActivePlayerForGame).toHaveBeenCalledWith(
      'game-1',
      authUser.id,
    );
    expect(gameCommandsService.endTurn).toHaveBeenCalledWith({
      gameId: 'game-1',
      roomPlayerId: 'room-player-1',
    });
    expect(gameRealtimePublisher.publishCommandResult).toHaveBeenCalledWith(
      'game-1',
      {
        ...commandResult,
        intentType: 'end_turn',
      },
    );
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
    expect(server.to).not.toHaveBeenCalled();
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
        events: engineEvents,
      },
    });
  });

  it('returns command result when realtime publish fails', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.rollAndMove.mockResolvedValue(commandResult);
    gameRealtimePublisher.publishCommandResult.mockRejectedValue(
      new Error('pubsub down'),
    );

    const result = await gateway.rollAndMove(socket, {
      gameId: 'game-1',
      dice: [3, 4],
    });

    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
        events: engineEvents,
      },
    });
    expect(gameBotQueueService.enqueueIfBotCanAct).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
  });

  it('returns command result when bot queue fails', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.rollAndMove.mockResolvedValue(commandResult);
    gameBotQueueService.enqueueIfBotCanAct.mockRejectedValue(
      new Error('queue down'),
    );

    const result = await gateway.rollAndMove(socket, {
      gameId: 'game-1',
      dice: [3, 4],
    });

    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
        events: engineEvents,
      },
    });
    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      gameState,
    );
  });

  it('returns command result when turn timer queue fails', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.rollAndMove.mockResolvedValue(commandResult);
    gameTurnTimerQueueService.enqueueTurnTimer.mockRejectedValue(
      new Error('timer queue down'),
    );

    const result = await gateway.rollAndMove(socket, {
      gameId: 'game-1',
      dice: [3, 4],
    });

    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
        events: engineEvents,
      },
    });
  });

  it('emits command rejected for engine errors', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    const error = new GameEngineError(
      'NOT_CURRENT_TURN',
      'It is not this player’s turn',
    );

    gameCommandsService.rollAndMove.mockRejectedValue(error);

    await expect(
      gateway.rollAndMove(socket, {
        gameId: 'game-1',
        dice: [3, 4],
      }),
    ).rejects.toThrow(WsException);

    expect(socket.emit).toHaveBeenCalledWith(
      GAME_SOCKET_EVENTS.commandRejected,
      {
        gameId: 'game-1',
        command: GAME_SOCKET_EVENTS.rollAndMove,
        code: 'NOT_CURRENT_TURN',
        message: 'It is not this player’s turn',
      },
    );
    expect(gameRealtimePublisher.publishCommandResult).not.toHaveBeenCalled();
    expect(gameBotQueueService.enqueueIfBotCanAct).not.toHaveBeenCalled();
    expect(gameTurnTimerQueueService.enqueueTurnTimer).not.toHaveBeenCalled();
  });
});

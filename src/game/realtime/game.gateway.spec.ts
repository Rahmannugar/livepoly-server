import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { AuthRepository } from '../../auth/auth.repository';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { GameCommandsService } from '../commands/game-commands.service';
import { GAME_EVENTS, GAME_SOCKET_EVENTS } from '../game.constants';
import type { GameEngineState } from '../engine/game-engine.types';
import type { GameAccessRepository } from './game-access.repository';
import { GameGateway } from './game.gateway';
import type { AuthenticatedGameSocket } from './game-realtime.types';

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
};

type GameAccessRepositoryMock = {
  findActivePlayerForGame: jest.Mock;
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
  let server: ServerMock;
  let roomEmitter: { emit: jest.Mock };

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
    lastDiceRoll: null,
    players: [],
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
    };

    gameAccessRepository = {
      findActivePlayerForGame: jest.fn().mockResolvedValue(playerAccess),
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
    );

    Object.defineProperty(gateway, 'server', {
      value: server,
    });
  });

  it('disconnects unauthenticated socket connection', async () => {
    const socket = makeSocket(null);

    await gateway.handleConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.error, {
      message: 'Authentication required',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.user).toBeUndefined();
  });

  it('authenticates socket connection', async () => {
    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret: 'access-secret',
    });
    expect(authRepository.findUserByIdForAuthToken).toHaveBeenCalledWith(
      authUser.id,
    );
    expect(socket.data.user).toEqual(authUser);
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.socketConnected,
      {
        socketId: socket.id,
        userId: authUser.id,
        username: authUser.username,
      },
    );
  });

  it('denies join when socket user is not an active player in the game', async () => {
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
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.socketAccessDenied,
      {
        gameId: 'game-1',
        userId: authUser.id,
      },
    );
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('joins socket room after active player access is verified', async () => {
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
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      GAME_EVENTS.socketJoined,
      {
        socketId: socket.id,
        userId: authUser.id,
        gameId: 'game-1',
      },
    );
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.joined,
      data: {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
      },
    });
  });

  it('resolves room player before rolling and broadcasting state', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.rollAndMove.mockResolvedValue({ state: gameState });

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
    expect(server.to).toHaveBeenCalledWith('game:game-1');
    expect(roomEmitter.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.state, {
      gameId: 'game-1',
      state: gameState,
    });
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
      },
    });
  });

  it('resolves room player before ending turn and broadcasting state', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;
    gameCommandsService.endTurn.mockResolvedValue({ state: gameState });

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
    expect(server.to).toHaveBeenCalledWith('game:game-1');
    expect(roomEmitter.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.state, {
      gameId: 'game-1',
      state: gameState,
    });
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.state,
      data: {
        gameId: 'game-1',
        state: gameState,
      },
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthRepository } from '../../../auth/auth.repository';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { GameRealtimeService } from '../game-realtime.service';
import type { AuthenticatedGameSocket } from '../game-realtime.types';
import { GameGateway } from '../game.gateway';
import { GAME_SOCKET_EVENTS } from '../../game.constants';

type GameRealtimeServiceMock = {
  joinGame: jest.Mock;
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

type GameSocketMock = AuthenticatedGameSocket & {
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameRealtimeService: GameRealtimeServiceMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;
  let authRepository: AuthRepositoryMock;
  let observabilityService: ObservabilityServiceMock;

  const authUser = {
    id: 'user-1',
    email: 'player@example.com',
    username: 'playerone',
    role: 'player',
    status: 'active',
    sessionId: 'session-1',
    tokenVersion: 1,
  };

  const authUserRecord = {
    id: authUser.id,
    email: authUser.email,
    username: authUser.username,
    emailVerified: true,
    role: authUser.role,
    status: authUser.status,
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
    gameRealtimeService = {
      joinGame: jest.fn().mockResolvedValue({
        roomPlayerId: 'room-player-1',
      }),
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

    gateway = new GameGateway(
      gameRealtimeService as unknown as GameRealtimeService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      authRepository as unknown as AuthRepository,
      observabilityService as unknown as ObservabilityService,
    );
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

  it('disconnects suspended socket auth', async () => {
    authRepository.findUserByIdForAuthToken.mockResolvedValue({
      ...authUserRecord,
      status: 'suspended',
    });

    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.error, {
      message: 'Authentication required',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.data.user).toBeUndefined();
  });

  it('joins the game room after service approval', async () => {
    const socket = makeSocket();
    socket.data.user = authUser;

    const result = await gateway.joinGame(socket, {
      gameId: 'game-1',
    });

    expect(gameRealtimeService.joinGame).toHaveBeenCalledWith({
      gameId: 'game-1',
      userId: authUser.id,
    });
    expect(socket.join).toHaveBeenCalledWith('game:game-1');
    expect(result).toEqual({
      event: GAME_SOCKET_EVENTS.joined,
      data: {
        gameId: 'game-1',
        roomPlayerId: 'room-player-1',
      },
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthRepository } from '../../../auth/auth.repository';
import type { AuthTokenVersionCacheService } from '../../../auth/auth-token-version-cache.service';
import type { ObservabilityService } from '../../../infra/observability/observability.service';
import type { RateLimitService } from '../../../rate-limit/rate-limit.service';
import type { GamePresenceService } from '../../presence/game-presence.service';
import type { GameRealtimeService } from '../game-realtime.service';
import type { AuthenticatedGameSocket } from '../game-realtime.types';
import { GameGateway } from '../game.gateway';
import { GAME_SOCKET_EVENTS } from '../../game.constants';

type GameRealtimeServiceMock = {
  joinGame: jest.Mock;
  rollAndMove: jest.Mock;
  endTurn: jest.Mock;
};

type GamePresenceServiceMock = {
  track: jest.Mock;
  remove: jest.Mock;
  getSummary: jest.Mock;
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

type AuthTokenVersionCacheServiceMock = {
  get: jest.Mock;
  set: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
};

type RateLimitServiceMock = {
  consume: jest.Mock;
};

type GameSocketMock = AuthenticatedGameSocket & {
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
};

describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameRealtimeService: GameRealtimeServiceMock;
  let gamePresenceService: GamePresenceServiceMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;
  let authRepository: AuthRepositoryMock;
  let authTokenVersionCacheService: AuthTokenVersionCacheServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let rateLimitService: RateLimitServiceMock;

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
        access: 'player',
        roomPlayerId: 'room-player-1',
        state: {
          version: 1,
          roomId: 'room-1',
          roomCode: 'ABC12345',
          boardKey: 'classic',
          mode: 'casual',
          phase: 'awaiting_roll',
          turnNumber: 1,
          currentTurnRoomPlayerId: 'room-player-1',
          consecutiveDoublesCount: 0,
          shouldCurrentPlayerPlayAgain: false,
          decks: {
            chance: { drawPile: [], discardPile: [] },
            worldFund: { drawPile: [], discardPile: [] },
          },
          players: [],
          properties: [],
        },
      }),
      rollAndMove: jest.fn(),
      endTurn: jest.fn(),
    };

    gamePresenceService = {
      track: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      getSummary: jest.fn(),
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

    authTokenVersionCacheService = {
      get: jest.fn().mockResolvedValue(authUser.tokenVersion),
      set: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
    };

    rateLimitService = {
      consume: jest.fn().mockResolvedValue(undefined),
    };

    gateway = new GameGateway(
      gameRealtimeService as unknown as GameRealtimeService,
      gamePresenceService as unknown as GamePresenceService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      authRepository as unknown as AuthRepository,
      authTokenVersionCacheService as unknown as AuthTokenVersionCacheService,
      observabilityService as unknown as ObservabilityService,
      rateLimitService as unknown as RateLimitService,
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
    expect(authTokenVersionCacheService.get).toHaveBeenCalledWith(authUser.id);
    expect(authTokenVersionCacheService.set).not.toHaveBeenCalled();
    expect(socket.data.user).toEqual(authUser);
  });

  it('disconnects sockets when cached token version is stale', async () => {
    authTokenVersionCacheService.get.mockResolvedValue(
      authUser.tokenVersion + 1,
    );
    const socket = makeSocket();

    await gateway.handleConnection(socket);

    expect(authRepository.findUserByIdForAuthToken).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(GAME_SOCKET_EVENTS.error, {
      message: 'Authentication required',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
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
        access: 'player',
        roomPlayerId: 'room-player-1',
        state: expect.objectContaining({
          roomId: 'room-1',
          phase: 'awaiting_roll',
        }),
      },
    });
  });
});

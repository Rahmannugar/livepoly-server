import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { AuthRepository } from '../../auth/auth.repository';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { RateLimitException } from '../../rate-limit/rate-limit.exception';
import { RateLimitService } from '../../rate-limit/rate-limit.service';
import { GameEngineError } from '../engine/game-engine.types';
import {
  GAME_EVENTS,
  GAME_PRESENCE,
  GAME_SOCKET_EVENTS,
  GAME_WS_RECONNECT_GUARD,
} from '../game.constants';
import { GameRealtimeService } from './game-realtime.service';
import {
  type GameEventsRecoveredEvent,
  type GameJoinedEvent,
  type RecoverGameEventsPayload,
  type AuthenticatedGameSocket,
  type EndTurnPayload,
  type GameCommandRejectedEvent,
  type GameErrorEvent,
  type JoinGamePayload,
  type RollAndMovePayload,
  type GameHeartbeatPayload,
  type GameHeartbeatAcknowledgedEvent,
  type GamePresenceEvent,
  type GamePresenceGetPayload,
} from './game-realtime.types';
import { GamePresenceService } from '../presence/game-presence.service';

type AccessTokenPayload = {
  sub: string;
  sid: string;
  tv: number;
  email: string;
  username: string;
};

@WebSocketGateway({
  namespace: 'game',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly gameRealtimeService: GameRealtimeService,
    private readonly gamePresenceService: GamePresenceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly observabilityService: ObservabilityService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async handleConnection(socket: AuthenticatedGameSocket): Promise<void> {
    try {
      await this.consumeConnectionLimit(socket);
      socket.data.user = await this.authenticate(socket);

      this.observabilityService.recordEvent(GAME_EVENTS.socketConnected, {
        socketId: socket.id,
        userId: socket.data.user.id,
        username: socket.data.user.username,
      });
    } catch (error) {
      socket.emit(GAME_SOCKET_EVENTS.error, {
        ...this.toSocketConnectionError(error),
      } satisfies GameErrorEvent);

      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthenticatedGameSocket): void {
    if (socket.data.user && socket.data.gameId) {
      void this.gamePresenceService.remove({
        gameId: socket.data.gameId,
        userId: socket.data.user.id,
        socketId: socket.id,
      });
    }

    this.observabilityService.recordEvent(GAME_EVENTS.socketDisconnected, {
      socketId: socket.id,
      userId: socket.data.user?.id,
      username: socket.data.user?.username,
    });
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.join)
  async joinGame(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: JoinGamePayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      await this.consumeUserGameLimit({
        scope: 'game:ws:join',
        userId: socket.data.user.id,
        gameId: payload.gameId,
        rule: GAME_WS_RECONNECT_GUARD.join,
      });

      const access = await this.gameRealtimeService.joinGame({
        gameId: payload.gameId,
        userId: socket.data.user.id,
      });

      await socket.join(this.gameRoom(payload.gameId));

      await this.gamePresenceService.track({
        gameId: payload.gameId,
        userId: socket.data.user.id,
        socketId: socket.id,
        access: access.access,
      });

      socket.data.gameId = payload.gameId;

      this.observabilityService.recordEvent(GAME_EVENTS.socketJoined, {
        socketId: socket.id,
        userId: socket.data.user.id,
        gameId: payload.gameId,
      });

      return {
        event: GAME_SOCKET_EVENTS.joined,
        data: {
          gameId: payload.gameId,
          ...access,
        } satisfies GameJoinedEvent,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.rollAndMove)
  async rollAndMove(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: RollAndMovePayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      const result = await this.gameRealtimeService.rollAndMove({
        gameId: payload.gameId,
        userId: socket.data.user.id,
        dice: payload.dice,
      });

      return {
        event: GAME_SOCKET_EVENTS.state,
        data: {
          gameId: payload.gameId,
          state: result.state,
          events: result.events,
        },
      };
    } catch (error) {
      this.emitCommandRejected(
        socket,
        payload.gameId,
        GAME_SOCKET_EVENTS.rollAndMove,
        error,
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.endTurn)
  async endTurn(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: EndTurnPayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      const result = await this.gameRealtimeService.endTurn({
        gameId: payload.gameId,
        userId: socket.data.user.id,
      });

      return {
        event: GAME_SOCKET_EVENTS.state,
        data: {
          gameId: payload.gameId,
          state: result.state,
          events: result.events,
        },
      };
    } catch (error) {
      this.emitCommandRejected(
        socket,
        payload.gameId,
        GAME_SOCKET_EVENTS.endTurn,
        error,
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.eventsGet)
  async recoverEvents(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: RecoverGameEventsPayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      await this.consumeUserGameLimit({
        scope: 'game:ws:events:get',
        userId: socket.data.user.id,
        gameId: payload.gameId,
        rule: GAME_WS_RECONNECT_GUARD.eventRecovery,
      });

      const result = await this.gameRealtimeService.recoverEvents({
        gameId: payload.gameId,
        userId: socket.data.user.id,
        cursor: payload.cursor,
      });

      return {
        event: GAME_SOCKET_EVENTS.eventsRecovered,
        data: {
          gameId: payload.gameId,
          ...result,
        } satisfies GameEventsRecoveredEvent,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.heartbeat)
  async heartbeat(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: GameHeartbeatPayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      await this.consumeUserGameLimit({
        scope: 'game:ws:heartbeat',
        userId: socket.data.user.id,
        gameId: payload.gameId,
        rule: GAME_WS_RECONNECT_GUARD.heartbeat,
      });

      const access = await this.gameRealtimeService.joinGame({
        gameId: payload.gameId,
        userId: socket.data.user.id,
      });

      await this.gamePresenceService.track({
        gameId: payload.gameId,
        userId: socket.data.user.id,
        socketId: socket.id,
        access: access.access,
      });

      socket.data.gameId = payload.gameId;

      return {
        event: GAME_SOCKET_EVENTS.heartbeatAcknowledged,
        data: {
          gameId: payload.gameId,
          receivedAt: new Date().toISOString(),
          ttlSeconds: GAME_PRESENCE.ttlSeconds,
        } satisfies GameHeartbeatAcknowledgedEvent,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.presenceGet)
  async getPresence(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: GamePresenceGetPayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      await this.consumeUserGameLimit({
        scope: 'game:ws:presence:get',
        userId: socket.data.user.id,
        gameId: payload.gameId,
        rule: GAME_WS_RECONNECT_GUARD.presence,
      });

      await this.gameRealtimeService.joinGame({
        gameId: payload.gameId,
        userId: socket.data.user.id,
      });

      const summary = await this.gamePresenceService.getSummary(payload.gameId);

      return {
        event: GAME_SOCKET_EVENTS.presence,
        data: summary satisfies GamePresenceEvent,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private emitCommandRejected(
    socket: AuthenticatedGameSocket,
    gameId: string,
    command: string,
    error: unknown,
  ): void {
    socket.emit(GAME_SOCKET_EVENTS.commandRejected, {
      gameId,
      command,
      ...this.toCommandRejectedError(error),
    } satisfies GameCommandRejectedEvent);
  }

  private toCommandRejectedError(
    error: unknown,
  ): Pick<GameCommandRejectedEvent, 'code' | 'message'> {
    if (error instanceof GameEngineError) {
      return {
        code: error.code,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
      };
    }

    return {
      message: 'Game command failed',
    };
  }

  private async authenticate(
    socket: AuthenticatedGameSocket,
  ): Promise<AuthUser> {
    const token = this.getSocketToken(socket);

    if (!token) {
      throw new WsException('Authentication required');
    }

    const payload = await this.verifyToken(token);
    const user = await this.authRepository.findUserByIdForAuthToken(
      payload.sub,
    );

    if (
      !user ||
      !user.emailVerified ||
      user.status !== 'active' ||
      user.deletedAt ||
      user.tokenVersion !== payload.tv
    ) {
      throw new WsException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      sessionId: payload.sid,
      tokenVersion: user.tokenVersion,
    };
  }

  private getSocketToken(socket: AuthenticatedGameSocket): string | null {
    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken;
    }

    const authorization = socket.handshake.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private async verifyToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new WsException('Authentication required');
    }
  }

  private assertAuthenticated(socket: AuthenticatedGameSocket): void {
    if (!socket.data.user) {
      throw new WsException('Authentication required');
    }
  }

  private assertGameId(gameId: string): void {
    if (!gameId || typeof gameId !== 'string') {
      throw new WsException('Invalid game id');
    }
  }

  private toWsException(error: unknown): WsException {
    if (error instanceof RateLimitException) {
      return new WsException({
        message: 'Too many realtime requests. Try again shortly.',
        code: 'rate_limited',
      });
    }

    if (error instanceof GameEngineError) {
      return new WsException({
        message: error.message,
        code: error.code,
      });
    }

    if (error instanceof Error) {
      return new WsException({
        message: error.message,
      });
    }

    return new WsException({
      message: 'Game command failed',
    });
  }

  private gameRoom(gameId: string): string {
    return `game:${gameId}`;
  }

  private async consumeConnectionLimit(
    socket: AuthenticatedGameSocket,
  ): Promise<void> {
    await this.rateLimitService.consume({
      scope: 'game:ws:connect',
      identifier: this.socketIp(socket),
      ...GAME_WS_RECONNECT_GUARD.connection,
    });
  }

  private async consumeUserGameLimit(input: {
    scope: string;
    userId: string;
    gameId: string;
    rule: {
      limit: number;
      windowSeconds: number;
      burstLimit: number;
    };
  }): Promise<void> {
    await this.rateLimitService.consume({
      scope: input.scope,
      identifier: `${input.userId}:${input.gameId}`,
      ...input.rule,
    });
  }

  private socketIp(socket: AuthenticatedGameSocket): string {
    const forwardedFor = socket.handshake.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor[0]) {
      return forwardedFor[0];
    }

    return socket.handshake.address ?? socket.id;
  }

  private toSocketConnectionError(error: unknown): GameErrorEvent {
    if (error instanceof RateLimitException) {
      return {
        message: 'Too many realtime connection attempts. Try again shortly.',
        code: 'rate_limited',
      };
    }

    return {
      message: 'Authentication required',
    };
  }
}

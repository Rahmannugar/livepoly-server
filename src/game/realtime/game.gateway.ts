import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { AuthRepository } from '../../auth/auth.repository';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { GameCommandsService } from '../commands/game-commands.service';
import { GameEngineError } from '../engine/game-engine.types';
import {
  type AuthenticatedGameSocket,
  type EndTurnPayload,
  type GameErrorEvent,
  type JoinGamePayload,
  type RollAndMovePayload,
} from './game-realtime.types';
import { GAME_EVENTS, GAME_SOCKET_EVENTS } from '../game.constants';
import { GameAccessRepository } from './game-access.repository';

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
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly gameCommandsService: GameCommandsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly observabilityService: ObservabilityService,
    private readonly gameAccessRepository: GameAccessRepository,
  ) {}

  async handleConnection(socket: AuthenticatedGameSocket): Promise<void> {
    try {
      socket.data.user = await this.authenticate(socket);
      this.observabilityService.recordEvent(GAME_EVENTS.socketConnected, {
        socketId: socket.id,
        userId: socket.data.user.id,
        username: socket.data.user.username,
      });
    } catch {
      socket.emit(GAME_SOCKET_EVENTS.error, {
        message: 'Authentication required',
      } satisfies GameErrorEvent);

      socket.disconnect(true);
    }
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.join)
  async joinGame(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: JoinGamePayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    const player = await this.assertPlayerCanAccessGame(
      payload.gameId,
      socket.data.user.id,
    );

    await socket.join(this.gameRoom(payload.gameId));

    this.observabilityService.recordEvent(GAME_EVENTS.socketJoined, {
      socketId: socket.id,
      userId: socket.data.user.id,
      gameId: payload.gameId,
    });

    return {
      event: GAME_SOCKET_EVENTS.joined,
      data: {
        gameId: payload.gameId,
        roomPlayerId: player.roomPlayerId,
      },
    };
  }

  @SubscribeMessage(GAME_SOCKET_EVENTS.rollAndMove)
  async rollAndMove(
    @ConnectedSocket() socket: AuthenticatedGameSocket,
    @MessageBody() payload: RollAndMovePayload,
  ) {
    this.assertAuthenticated(socket);
    this.assertGameId(payload.gameId);

    try {
      const player = await this.assertPlayerCanAccessGame(
        payload.gameId,
        socket.data.user.id,
      );

      const result = await this.gameCommandsService.rollAndMove({
        gameId: payload.gameId,
        roomPlayerId: player.roomPlayerId,
        dice: payload.dice,
      });

      this.broadcastState(payload.gameId, result.state);

      return {
        event: GAME_SOCKET_EVENTS.state,
        data: {
          gameId: payload.gameId,
          state: result.state,
        },
      };
    } catch (error) {
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
      const player = await this.assertPlayerCanAccessGame(
        payload.gameId,
        socket.data.user.id,
      );

      const result = await this.gameCommandsService.endTurn({
        gameId: payload.gameId,
        roomPlayerId: player.roomPlayerId,
      });

      this.broadcastState(payload.gameId, result.state);

      return {
        event: GAME_SOCKET_EVENTS.state,
        data: {
          gameId: payload.gameId,
          state: result.state,
        },
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private broadcastState(gameId: string, state: unknown): void {
    this.server.to(this.gameRoom(gameId)).emit(GAME_SOCKET_EVENTS.state, {
      gameId,
      state,
    });
  }

  private async assertPlayerCanAccessGame(gameId: string, userId: string) {
    const player = await this.gameAccessRepository.findActivePlayerForGame(
      gameId,
      userId,
    );

    if (!player) {
      this.observabilityService.recordEvent(GAME_EVENTS.socketAccessDenied, {
        gameId,
        userId,
      });

      throw new WsException('Game access denied');
    }

    return player;
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
      user.deletedAt ||
      user.tokenVersion !== payload.tv
    ) {
      throw new WsException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
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
}

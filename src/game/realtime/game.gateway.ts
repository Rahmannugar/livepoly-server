import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AuthRepository } from '../../auth/auth.repository';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { PubSubService } from '../../infra/pubsub/pubsub.service';
import type {
  PubSubPayload,
  PubSubSubscription,
} from '../../infra/pubsub/pubsub.types';
import { GameBotQueueService } from '../bots/game-bot-queue.service';
import type { GameCommandResult } from '../commands/game-commands.types';
import { GameCommandsService } from '../commands/game-commands.service';
import {
  GameEngineError,
  type GameEngineEvent,
} from '../engine/game-engine.types';
import {
  GAME_EVENTS,
  GAME_METRICS,
  GAME_REALTIME,
  GAME_SOCKET_EVENTS,
} from '../game.constants';
import { GameTurnTimerQueueService } from '../timers/game-turn-timer-queue.service';
import { GameAccessRepository } from './game-access.repository';
import {
  type AuthenticatedGameSocket,
  type EndTurnPayload,
  type GameCommandRejectedEvent,
  type GameErrorEvent,
  type GameEventsEvent,
  type GameRealtimePubSubMessage,
  type GameStateEvent,
  type JoinGamePayload,
  type RollAndMovePayload,
} from './game-realtime.types';
import { GameRealtimePublisher } from './game-realtime.publisher';

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
export class GameGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private realtimeSubscription: PubSubSubscription | null = null;

  constructor(
    private readonly gameCommandsService: GameCommandsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly observabilityService: ObservabilityService,
    private readonly gameAccessRepository: GameAccessRepository,
    private readonly pubSubService: PubSubService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly gameBotQueueService: GameBotQueueService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.realtimeSubscription = await this.pubSubService.subscribe(
      GAME_REALTIME.channel,
      (payload) => this.handleRealtimeMessage(payload),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.realtimeSubscription?.unsubscribe();
    this.realtimeSubscription = null;
  }

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

  handleDisconnect(socket: AuthenticatedGameSocket): void {
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

      await this.afterCommandSucceeded(payload.gameId, result);

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
      const player = await this.assertPlayerCanAccessGame(
        payload.gameId,
        socket.data.user.id,
      );

      const result = await this.gameCommandsService.endTurn({
        gameId: payload.gameId,
        roomPlayerId: player.roomPlayerId,
      });

      await this.afterCommandSucceeded(payload.gameId, result);

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

  private async afterCommandSucceeded(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    await this.publishRealtimeBestEffort(gameId, result);
    await this.enqueueBotBestEffort(gameId, result);
    await this.enqueueTurnTimerBestEffort(gameId, result);
  }

  private async publishRealtimeBestEffort(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameRealtimePublisher.publishCommandResult(gameId, result);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.realtimePublishFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(
        GAME_METRICS.realtimePublishFailed,
      );
    }
  }

  private async enqueueBotBestEffort(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameBotQueueService.enqueueIfBotCanAct(gameId, result.state);
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.botTurnFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.botTurnFailed);
    }
  }

  private async enqueueTurnTimerBestEffort(
    gameId: string,
    result: GameCommandResult,
  ): Promise<void> {
    try {
      await this.gameTurnTimerQueueService.enqueueTurnTimer(
        gameId,
        result.state,
      );
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.turnTimerFailed, {
        gameId,
        phase: result.state.phase,
        turnNumber: result.state.turnNumber,
        reason: 'queue_failed',
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(GAME_METRICS.turnTimerFailed);
    }
  }

  private handleRealtimeMessage(payload: PubSubPayload): void {
    if (!this.isGameRealtimePubSubMessage(payload)) {
      return;
    }

    this.broadcastState(payload.gameId, payload.state);
    this.broadcastEvents(payload.gameId, payload.events);
  }

  private isGameRealtimePubSubMessage(
    payload: PubSubPayload,
  ): payload is PubSubPayload & GameRealtimePubSubMessage {
    return (
      payload.type === 'game_command_result' &&
      typeof payload.gameId === 'string' &&
      typeof payload.state === 'object' &&
      payload.state !== null &&
      Array.isArray(payload.events)
    );
  }

  private broadcastState(gameId: string, state: GameStateEvent['state']): void {
    this.server.to(this.gameRoom(gameId)).emit(GAME_SOCKET_EVENTS.state, {
      gameId,
      state,
    } satisfies GameStateEvent);
  }

  private broadcastEvents(gameId: string, events: GameEngineEvent[]): void {
    if (events.length === 0) {
      return;
    }

    this.server.to(this.gameRoom(gameId)).emit(GAME_SOCKET_EVENTS.events, {
      gameId,
      events,
    } satisfies GameEventsEvent);
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

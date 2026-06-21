import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { GameCommandsService } from '../../game/commands/game-commands.service';
import { GameRecoveryService } from '../../game/recovery/game-recovery.service';
import { GameResultsService } from '../../game/results/game-results.service';
import { GameRealtimePublisher } from '../../game/realtime/game-realtime.publisher';
import { GAME_EVENTS, GAME_METRICS } from '../../game/game.constants';
import {
  DatabaseService,
  type DatabaseExecutor,
} from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { InviteRoomDto } from '../dto/invite-room.dto';
import { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import { RoomsStreamService } from './rooms-stream.service';
import {
  DEFAULT_ROOM_DURATION_MINUTES,
  LIVE_ROOMS_LIMIT,
  ROOM_BOARD_KEY,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_EVENTS,
  ROOM_METRICS,
  ROOM_MAX_PLAYERS,
  ROOM_MAX_SPECTATORS,
} from '../rooms.constants';

@Injectable()
export class RoomsLobbyService {
  private readonly logger = new Logger(RoomsLobbyService.name);

  constructor(
    private readonly roomsLobbyRepository: RoomsLobbyRepository,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxQueueService: OutboxQueueService,
    private readonly observabilityService: ObservabilityService,
    private readonly gameRecoveryService: GameRecoveryService,
    private readonly gameResultsService: GameResultsService,
    private readonly gameCommandsService: GameCommandsService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly roomsStreamService: RoomsStreamService,
  ) {}

  async createRoom(authUser: AuthUser, dto: CreateRoomDto) {
    await this.finalizeExpiredActiveRoomForUser(authUser.id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateRoomCode();

      try {
        const room = await this.databaseService.transaction(async (tx) => {
          await this.roomsLobbyRepository.lockActiveRoomMembershipForUser(
            authUser.id,
            tx,
          );
          await this.ensureUserHasNoActiveRoom(authUser.id, tx);

          const createdRoom = await this.roomsLobbyRepository.createRoom(
            {
              code,
              hostUserId: authUser.id,
              durationMinutes:
                dto.durationMinutes ?? DEFAULT_ROOM_DURATION_MINUTES,
              boardKey: ROOM_BOARD_KEY,
            },
            tx,
          );

          await this.roomsLobbyRepository.addHumanPlayer(
            {
              roomId: createdRoom.id,
              userId: authUser.id,
              seatNumber: 1,
            },
            tx,
          );

          return createdRoom;
        });

        this.observabilityService.recordEvent(ROOM_EVENTS.created, {
          roomId: room.id,
          roomCode: room.code,
          userId: authUser.id,
          durationMinutes: room.durationMinutes,
          boardKey: room.boardKey,
        });
        this.observabilityService.recordMetric(ROOM_METRICS.created);
        await this.roomsStreamService.publishRoomChanged({
          roomId: room.id,
          roomCode: room.code,
          event: 'room.created',
        });

        return this.getRoomPayload(room.id, room, authUser.id);
      } catch (error) {
        if (this.roomsLobbyRepository.isRoomCodeUniqueViolation(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Could not create room');
  }

  async listLiveRooms(authUser: AuthUser) {
    const rooms =
      await this.roomsLobbyRepository.listLiveRooms(LIVE_ROOMS_LIMIT);
    const roomIds = rooms.map((room) => room.id);
    const activeGames =
      await this.roomsLobbyRepository.listActiveGamesForRooms(roomIds);

    const expiredActiveGameRoomIds =
      this.getExpiredActiveGameRoomIds(activeGames);

    const nonExpiredRooms = rooms.filter(
      (room) => !expiredActiveGameRoomIds.has(room.id),
    );
    const nonExpiredRoomIds = nonExpiredRooms.map((room) => room.id);

    const players =
      await this.roomsLobbyRepository.listPlayersForRooms(nonExpiredRoomIds);
    const liveRooms = nonExpiredRooms.filter((room) =>
      players.some(
        (player) =>
          player.roomId === room.id &&
          player.playerType === 'human' &&
          player.status === 'joined',
      ),
    );
    const liveRoomIds = liveRooms.map((room) => room.id);
    const spectatorCounts =
      await this.roomsLobbyRepository.countCurrentSpectatorsForRooms(
        liveRoomIds,
      );
    const spectatorCountByRoomId = new Map(
      spectatorCounts.map((item) => [item.roomId, item.value]),
    );
    const currentActiveGames = activeGames.filter(
      (game) => !expiredActiveGameRoomIds.has(game.roomId),
    );
    const activeGameIdByRoomId = new Map(
      currentActiveGames.map((game) => [game.roomId, game.id]),
    );

    const currentSpectators =
      await this.roomsLobbyRepository.listCurrentSpectatorsForUserRoomIds(
        authUser.id,
        liveRoomIds,
      );
    const currentSpectatorRoomIds = new Set(
      currentSpectators.map((spectator) => spectator.roomId),
    );

    return liveRooms.map((room) => {
      const roomPlayers = players.filter((player) => player.roomId === room.id);

      return {
        ...room,
        spectatorCount: spectatorCountByRoomId.get(room.id) ?? 0,
        activeGameId: activeGameIdByRoomId.get(room.id) ?? null,
        currentUserAccess: this.getCurrentUserAccess({
          authUserId: authUser.id,
          players: roomPlayers,
          isCurrentSpectator: currentSpectatorRoomIds.has(room.id),
        }),
        players: roomPlayers,
      };
    });
  }

  async getCurrentRoom(authUser: AuthUser) {
    const room = await this.roomsLobbyRepository.findActiveRoomForUser(
      authUser.id,
    );

    if (!room) {
      return null;
    }

    if (await this.roomHasExpiredActiveGame(room.id)) {
      return null;
    }

    return this.getRoomPayload(room.id, room, authUser.id);
  }

  async getRoomByCode(authUser: AuthUser, code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.getRoomPayload(room.id, room, authUser.id);
  }

  async joinRoom(authUser: AuthUser, code: string) {
    await this.finalizeExpiredActiveRoomForUser(authUser.id);

    const result = await this.databaseService.transaction(async (tx) => {
      await this.roomsLobbyRepository.lockActiveRoomMembershipForUser(
        authUser.id,
        tx,
      );
      await this.ensureUserHasNoActiveRoom(authUser.id, tx);

      const room = await this.roomsLobbyRepository.lockRoomByCode(code, tx);

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      if (room.status !== 'waiting') {
        throw new ConflictException('Room is not open');
      }

      const joinedPlayers = await this.roomsLobbyRepository.listJoinedPlayers(
        room.id,
        tx,
      );
      const seatNumber = this.findFirstFreeSeat(
        joinedPlayers.map((player) => player.seatNumber),
      );

      if (!seatNumber) {
        throw new ConflictException('Room is full');
      }

      try {
        await this.roomsLobbyRepository.addHumanPlayer(
          {
            roomId: room.id,
            userId: authUser.id,
            seatNumber,
          },
          tx,
        );
      } catch (error) {
        if (this.roomsLobbyRepository.isSeatUniqueViolation(error)) {
          throw new ConflictException('Room seat is no longer available');
        }

        throw error;
      }

      return {
        room,
        seatNumber,
      };
    });

    this.observabilityService.recordEvent(ROOM_EVENTS.joined, {
      roomId: result.room.id,
      roomCode: result.room.code,
      userId: authUser.id,
      seatNumber: result.seatNumber,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.joined);
    await this.roomsStreamService.publishRoomChanged({
      roomId: result.room.id,
      roomCode: result.room.code,
      event: 'room.joined',
    });

    return this.getRoomPayload(result.room.id, result.room, authUser.id);
  }

  async leaveRoom(authUser: AuthUser, code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const player = await this.roomsLobbyRepository.findJoinedPlayer(
      room.id,
      authUser.id,
    );

    if (!player) {
      const currentSpectator =
        await this.roomsLobbyRepository.findCurrentSpectator(
          room.id,
          authUser.id,
        );

      if (currentSpectator) {
        await this.roomsLobbyRepository.endSpectatorSession({
          roomId: room.id,
          userId: authUser.id,
        });

        return { message: 'Room left' };
      }

      const existingPlayer = await this.roomsLobbyRepository.findPlayer(
        room.id,
        authUser.id,
      );

      if (existingPlayer?.status === 'left') {
        return { message: 'Room already left' };
      }

      throw new NotFoundException('Room player not found');
    }

    if (room.hostUserId === authUser.id && room.status === 'waiting') {
      await this.databaseService.transaction(async (tx) => {
        await this.roomsLobbyRepository.leaveRoom(
          {
            roomId: room.id,
            userId: authUser.id,
          },
          tx,
        );

        await this.roomsLobbyRepository.cancelRoom(room.id, tx);
      });

      this.observabilityService.recordEvent(ROOM_EVENTS.cancelled, {
        roomId: room.id,
        roomCode: room.code,
        userId: authUser.id,
      });
      this.observabilityService.recordMetric(ROOM_METRICS.cancelled);
      await this.roomsStreamService.publishRoomChanged({
        roomId: room.id,
        roomCode: room.code,
        event: 'room.cancelled',
      });

      return { message: 'Room cancelled' };
    }

    const leaveResult = await this.databaseService.transaction(async (tx) => {
      const lockedRoom = await this.roomsLobbyRepository.lockRoomByCode(
        code,
        tx,
      );

      if (!lockedRoom) {
        throw new NotFoundException('Room not found');
      }

      if (lockedRoom.status === 'active') {
        const joinedHumanCount =
          await this.roomsLobbyRepository.countJoinedHumanPlayers(
            lockedRoom.id,
            tx,
          );
        const activeGame =
          await this.roomsLobbyRepository.findActiveGameByRoomId(
            lockedRoom.id,
            tx,
          );

        if (activeGame) {
          if (joinedHumanCount <= 1) {
            return {
              activeGameId: activeGame.id,
              shouldFinishAfterLastHumanLeft: true,
              leavingRoomPlayerId: player.id,
            };
          }

          return {
            activeGameId: activeGame.id,
            shouldFinishAfterLastHumanLeft: false,
            leavingRoomPlayerId: player.id,
          };
        }
      }

      await this.roomsLobbyRepository.leaveRoom(
        {
          roomId: lockedRoom.id,
          userId: authUser.id,
        },
        tx,
      );

      return {
        activeGameId: null,
        shouldFinishAfterLastHumanLeft: false,
        leavingRoomPlayerId: player.id,
      };
    });

    if (leaveResult.activeGameId) {
      try {
        if (leaveResult.shouldFinishAfterLastHumanLeft) {
          await this.finalizeRoomAfterLastHumanLeft({
            roomId: room.id,
            roomCode: room.code,
            gameId: leaveResult.activeGameId,
          });
        } else {
          const leavingPlayerAlreadyBankrupt =
            await this.isRoomPlayerBankruptInGame({
              gameId: leaveResult.activeGameId,
              roomPlayerId: leaveResult.leavingRoomPlayerId,
            });

          if (!leavingPlayerAlreadyBankrupt) {
            const result = await this.gameCommandsService.executeIntent({
              gameId: leaveResult.activeGameId,
              roomPlayerId: leaveResult.leavingRoomPlayerId,
              source: 'player',
              intent: {
                type: 'declare_bankruptcy',
                payload: {
                  roomPlayerId: leaveResult.leavingRoomPlayerId,
                  creditorRoomPlayerId: null,
                },
              },
            });

            await this.publishGameCommandResultBestEffort({
              gameId: leaveResult.activeGameId,
              result,
            });
          } else {
            this.logger.log({
              message: 'game_flow.leave.skipped_bankrupt_player_forfeit',
              roomId: room.id,
              roomCode: room.code,
              gameId: leaveResult.activeGameId,
              roomPlayerId: leaveResult.leavingRoomPlayerId,
            });
          }
        }

        await this.databaseService.transaction(async (tx) => {
          const lockedRoom = await this.roomsLobbyRepository.lockRoomByCode(
            code,
            tx,
          );

          if (!lockedRoom) {
            throw new NotFoundException('Room not found');
          }

          await this.roomsLobbyRepository.leaveRoom(
            {
              roomId: lockedRoom.id,
              userId: authUser.id,
            },
            tx,
          );
        });
      } catch (error) {
        this.observabilityService.recordEvent(
          ROOM_EVENTS.finishAfterLastHumanLeftFailed,
          {
            roomId: room.id,
            roomCode: room.code,
            gameId: leaveResult.activeGameId,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        );
        this.observabilityService.recordMetric(
          ROOM_METRICS.finishAfterLastHumanLeftFailed,
        );

        throw error;
      }
    }

    this.observabilityService.recordEvent(ROOM_EVENTS.left, {
      roomId: room.id,
      roomCode: room.code,
      userId: authUser.id,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.left);
    await this.roomsStreamService.publishRoomChanged({
      roomId: room.id,
      roomCode: room.code,
      event: 'room.left',
    });

    return { message: 'Room left' };
  }

  private async isRoomPlayerBankruptInGame(input: {
    gameId: string;
    roomPlayerId: string;
  }) {
    const state = await this.gameRecoveryService.getOrRecover(input.gameId);
    const player = state.players.find(
      (candidate) => candidate.roomPlayerId === input.roomPlayerId,
    );

    return Boolean(player?.bankrupt);
  }

  private async finalizeRoomAfterLastHumanLeft(input: {
    roomId: string;
    roomCode: string;
    gameId: string;
  }) {
    this.logger.log({
      message: 'game_flow.last_human.finalization_started',
      roomId: input.roomId,
      roomCode: input.roomCode,
      gameId: input.gameId,
    });

    const state = await this.gameRecoveryService.getOrRecover(input.gameId);
    const finishedAt = Date.now();

    if (state.phase === 'finished') {
      this.logger.log({
        message: 'game_flow.last_human.already_finished',
        roomId: input.roomId,
        roomCode: input.roomCode,
        gameId: input.gameId,
        phase: state.phase,
        turnNumber: state.turnNumber,
      });

      await this.gameResultsService.finalizeAbandonedFinishedGame({
        gameId: input.gameId,
        state,
        finishedAt,
      });
      this.recordFinishedAfterLastHumanLeft(input);
      return;
    }

    const result = await this.gameCommandsService.executeIntent({
      gameId: input.gameId,
      source: 'timer',
      intent: {
        type: 'finish_game_after_last_human_left',
        payload: {
          finishedAt,
        },
      },
    });

    this.logger.log({
      message: 'game_flow.last_human.finish_intent_executed',
      roomId: input.roomId,
      roomCode: input.roomCode,
      gameId: input.gameId,
      phase: result.state.phase,
      turnNumber: result.state.turnNumber,
      eventTypes: result.events.map((event) => event.type),
    });

    await this.publishGameCommandResultBestEffort({
      gameId: input.gameId,
      result,
    });

    this.recordFinishedAfterLastHumanLeft(input);
  }

  private async publishGameCommandResultBestEffort(input: {
    gameId: string;
    result: Awaited<ReturnType<GameCommandsService['executeIntent']>>;
  }): Promise<void> {
    try {
      await this.gameRealtimePublisher.publishCommandResult(
        input.gameId,
        input.result,
      );
    } catch (error) {
      this.observabilityService.recordEvent(GAME_EVENTS.realtimePublishFailed, {
        gameId: input.gameId,
        phase: input.result.state.phase,
        turnNumber: input.result.state.turnNumber,
        errorName: error instanceof Error ? error.name : undefined,
      });

      this.observabilityService.recordMetric(
        GAME_METRICS.realtimePublishFailed,
      );
    }
  }

  private recordFinishedAfterLastHumanLeft(input: {
    roomId: string;
    roomCode: string;
    gameId: string;
  }): void {
    this.observabilityService.recordEvent(
      ROOM_EVENTS.finishedAfterLastHumanLeft,
      {
        roomId: input.roomId,
        roomCode: input.roomCode,
        gameId: input.gameId,
      },
    );
    this.observabilityService.recordMetric(
      ROOM_METRICS.finishedAfterLastHumanLeft,
    );
  }

  async spectateRoom(authUser: AuthUser, code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== 'active') {
      throw new ConflictException('Only active rooms can be spectated');
    }

    if (await this.finalizeExpiredRoomGame(room.id)) {
      throw new ConflictException('Only active rooms can be spectated');
    }

    const player = await this.roomsLobbyRepository.findJoinedPlayer(
      room.id,
      authUser.id,
    );

    if (player) {
      throw new ConflictException(
        'Room players cannot spectate their own room',
      );
    }

    const currentSpectator =
      await this.roomsLobbyRepository.findCurrentSpectator(
        room.id,
        authUser.id,
      );

    if (currentSpectator) {
      return {
        message: 'Already spectating room',
        spectator: currentSpectator,
      };
    }

    const spectator = await this.databaseService.transaction(async (tx) => {
      const lockedRoom = await this.roomsLobbyRepository.lockRoomByCode(
        code,
        tx,
      );

      if (!lockedRoom) {
        throw new NotFoundException('Room not found');
      }

      if (lockedRoom.status !== 'active') {
        throw new ConflictException('Only active rooms can be spectated');
      }

      const spectatorCount =
        await this.roomsLobbyRepository.countCurrentSpectators(
          lockedRoom.id,
          tx,
        );

      if (spectatorCount >= ROOM_MAX_SPECTATORS) {
        throw new ConflictException('Room spectator limit reached');
      }

      return this.roomsLobbyRepository.createSpectator(
        {
          roomId: lockedRoom.id,
          userId: authUser.id,
        },
        tx,
      );
    });

    this.observabilityService.recordEvent(ROOM_EVENTS.spectatorJoined, {
      roomId: room.id,
      roomCode: room.code,
      userId: authUser.id,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.spectatorJoined);
    await this.roomsStreamService.publishRoomChanged({
      roomId: room.id,
      roomCode: room.code,
      event: 'room.spectator_joined',
    });

    return {
      message: 'Spectating room',
      spectator,
    };
  }

  async stopSpectatingRoom(authUser: AuthUser, code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const spectator = await this.roomsLobbyRepository.endSpectatorSession({
      roomId: room.id,
      userId: authUser.id,
    });

    if (!spectator) {
      throw new NotFoundException('Room spectator not found');
    }

    this.observabilityService.recordEvent(ROOM_EVENTS.spectatorLeft, {
      roomId: room.id,
      roomCode: room.code,
      userId: authUser.id,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.spectatorLeft);
    await this.roomsStreamService.publishRoomChanged({
      roomId: room.id,
      roomCode: room.code,
      event: 'room.spectator_left',
    });

    return {
      message: 'Stopped spectating room',
    };
  }

  async inviteToRoom(authUser: AuthUser, code: string, dto: InviteRoomDto) {
    const username = dto.username.trim().toLowerCase();

    if (username === authUser.username) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new ConflictException('Room is not open');
    }

    const inviterPlayer = await this.roomsLobbyRepository.findJoinedPlayer(
      room.id,
      authUser.id,
    );

    if (!inviterPlayer) {
      throw new NotFoundException('Room player not found');
    }

    const invitee =
      await this.roomsLobbyRepository.findActiveUserByUsername(username);

    if (!invitee) {
      throw new NotFoundException('User not found');
    }

    const friendship = await this.roomsLobbyRepository.findAcceptedFriendship(
      authUser.id,
      invitee.id,
    );

    if (!friendship) {
      throw new ConflictException('You can only invite friends');
    }

    const activeRoom = await this.roomsLobbyRepository.findActiveRoomForUser(
      invitee.id,
    );

    if (activeRoom) {
      throw new ConflictException('User is already in an active room');
    }

    const inviter = await this.roomsLobbyRepository.findActiveUserById(
      authUser.id,
    );

    if (!inviter) {
      throw new NotFoundException('User not found');
    }

    const result = await this.databaseService.transaction(async (tx) => {
      const notificationResult =
        await this.notificationsService.createRoomInviteNotification(
          {
            userId: invitee.id,
            roomId: room.id,
            roomCode: room.code,
            inviterId: inviter.id,
            inviterUsername: inviter.username,
            inviterAvatarObjectKey: inviter.avatarObjectKey,
          },
          tx,
        );

      return {
        outboxEventId: notificationResult.outboxEventId,
      };
    });

    await this.outboxQueueService.enqueuePublishEvent(result.outboxEventId);

    this.observabilityService.recordEvent(ROOM_EVENTS.inviteSent, {
      roomId: room.id,
      roomCode: room.code,
      inviterId: authUser.id,
      inviteeId: invitee.id,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.inviteSent);

    return {
      message: 'Room invite sent',
      roomCode: room.code,
    };
  }

  private async finalizeExpiredActiveRoomForUser(
    userId: string,
  ): Promise<void> {
    const activeRoom =
      await this.roomsLobbyRepository.findActiveRoomForUser(userId);

    if (activeRoom && (await this.finalizeExpiredRoomGame(activeRoom.id))) {
      return;
    }
  }

  private async ensureUserHasNoActiveRoom(
    userId: string,
    executor?: DatabaseExecutor,
  ) {
    const activeRoom = await this.roomsLobbyRepository.findActiveRoomForUser(
      userId,
      executor,
    );

    if (activeRoom) {
      throw new ConflictException('You are already in an active room');
    }
  }

  private async finalizeExpiredRoomGame(roomId: string): Promise<boolean> {
    const activeGame =
      await this.roomsLobbyRepository.findActiveGameByRoomId(roomId);

    if (!activeGame) {
      return false;
    }

    const state = await this.gameRecoveryService.getOrRecover(activeGame.id);
    const expiresAt = state.expiresAt ?? activeGame.expiresAt.getTime();
    const now = Date.now();

    if (now < expiresAt) {
      return false;
    }

    const finishedAt = Math.max(now, expiresAt);

    if (state.phase === 'finished') {
      await this.gameResultsService.finalizeExpiredFinishedGame({
        gameId: activeGame.id,
        state,
        finishedAt,
      });
      return true;
    }

    if (state.phase === 'cancelled') {
      return false;
    }

    try {
      await this.gameCommandsService.executeIntent({
        gameId: activeGame.id,
        source: 'timer',
        intent: {
          type: 'finish_game_by_time',
          payload: {
            finishedAt,
          },
        },
      });
    } catch (error) {
      const repairedState = await this.gameRecoveryService.getOrRecover(
        activeGame.id,
      );

      if (repairedState.phase !== 'finished') {
        throw error;
      }

      await this.gameResultsService.finalizeExpiredFinishedGame({
        gameId: activeGame.id,
        state: repairedState,
        finishedAt,
      });
    }

    return true;
  }

  private getExpiredActiveGameRoomIds(
    activeGames: { id: string; roomId: string; expiresAt: Date }[],
  ): Set<string> {
    const expiredRoomIds = new Set<string>();
    const now = Date.now();

    for (const game of activeGames) {
      if (game.expiresAt.getTime() > now) {
        continue;
      }

      expiredRoomIds.add(game.roomId);
    }

    return expiredRoomIds;
  }

  private async roomHasExpiredActiveGame(roomId: string): Promise<boolean> {
    const activeGame =
      await this.roomsLobbyRepository.findActiveGameByRoomId(roomId);

    return Boolean(activeGame && activeGame.expiresAt.getTime() <= Date.now());
  }

  private async getRoomPayload(
    roomId: string,
    room: {
      id: string;
      code: string;
      hostUserId: string;
      status: string;
      maxPlayers: number;
      durationMinutes: number;
      boardKey: string;
      createdAt: Date;
      startedAt: Date | null;
      endedAt: Date | null;
    },
    authUserId: string,
  ) {
    const players = await this.roomsLobbyRepository.listPlayers(roomId);
    const spectatorCount =
      await this.roomsLobbyRepository.countCurrentSpectators(roomId);
    const currentSpectator =
      await this.roomsLobbyRepository.findCurrentSpectator(roomId, authUserId);
    const activeGame =
      room.status === 'active'
        ? await this.roomsLobbyRepository.findActiveGameByRoomId(roomId)
        : null;
    const activeGameIsCurrent =
      activeGame && activeGame.expiresAt.getTime() > Date.now();

    return {
      ...room,
      spectatorCount,
      activeGameId: activeGameIsCurrent ? activeGame.id : null,
      currentUserAccess: this.getCurrentUserAccess({
        authUserId,
        players,
        isCurrentSpectator: Boolean(currentSpectator),
      }),
      players,
    };
  }

  private getCurrentUserAccess(input: {
    authUserId: string;
    players: Array<{
      userId: string | null;
      status: string;
    }>;
    isCurrentSpectator: boolean;
  }) {
    const currentPlayer = input.players.find(
      (player) =>
        player.userId === input.authUserId && player.status === 'joined',
    );

    if (currentPlayer) {
      return 'player';
    }

    if (input.isCurrentSpectator) {
      return 'spectator';
    }

    return 'none';
  }

  private findFirstFreeSeat(occupiedSeats: number[]) {
    const occupied = new Set(occupiedSeats);

    for (let seat = 1; seat <= ROOM_MAX_PLAYERS; seat += 1) {
      if (!occupied.has(seat)) {
        return seat;
      }
    }

    return null;
  }

  private generateRoomCode() {
    let code = '';

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }

    return code;
  }
}

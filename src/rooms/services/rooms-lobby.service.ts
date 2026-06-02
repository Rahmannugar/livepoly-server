import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import { CreateRoomDto } from '../dto/create-room.dto';
import { InviteRoomDto } from '../dto/invite-room.dto';
import { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
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
  constructor(
    private readonly roomsLobbyRepository: RoomsLobbyRepository,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxQueueService: OutboxQueueService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async createRoom(authUser: AuthUser, dto: CreateRoomDto) {
    await this.ensureUserHasNoActiveRoom(authUser.id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateRoomCode();

      try {
        const room = await this.databaseService.transaction(async (tx) => {
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

        return this.getRoomPayload(room.id, room);
      } catch (error) {
        if (this.roomsLobbyRepository.isRoomCodeUniqueViolation(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Could not create room');
  }

  async listLiveRooms() {
    const rooms =
      await this.roomsLobbyRepository.listLiveRooms(LIVE_ROOMS_LIMIT);

    const players = await this.roomsLobbyRepository.listPlayersForRooms(
      rooms.map((room) => room.id),
    );

    return rooms.map((room) => ({
      ...room,
      players: players.filter((player) => player.roomId === room.id),
    }));
  }

  async getRoomByCode(code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.getRoomPayload(room.id, room);
  }

  async joinRoom(authUser: AuthUser, code: string) {
    await this.ensureUserHasNoActiveRoom(authUser.id);

    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new ConflictException('Room is not open');
    }

    const joinedPlayers = await this.roomsLobbyRepository.listJoinedPlayers(
      room.id,
    );
    const seatNumber = this.findFirstFreeSeat(
      joinedPlayers.map((player) => player.seatNumber),
    );

    if (!seatNumber) {
      throw new ConflictException('Room is full');
    }

    try {
      await this.roomsLobbyRepository.addHumanPlayer({
        roomId: room.id,
        userId: authUser.id,
        seatNumber,
      });
    } catch (error) {
      if (this.roomsLobbyRepository.isSeatUniqueViolation(error)) {
        throw new ConflictException('Room seat is no longer available');
      }

      throw error;
    }

    this.observabilityService.recordEvent(ROOM_EVENTS.joined, {
      roomId: room.id,
      roomCode: room.code,
      userId: authUser.id,
      seatNumber,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.joined);

    return this.getRoomPayload(room.id, room);
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

      return { message: 'Room cancelled' };
    }

    await this.roomsLobbyRepository.leaveRoom({
      roomId: room.id,
      userId: authUser.id,
    });

    this.observabilityService.recordEvent(ROOM_EVENTS.left, {
      roomId: room.id,
      roomCode: room.code,
      userId: authUser.id,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.left);

    return { message: 'Room left' };
  }

  async spectateRoom(authUser: AuthUser, code: string) {
    const room = await this.roomsLobbyRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== 'active') {
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

  private async ensureUserHasNoActiveRoom(userId: string) {
    const activeRoom =
      await this.roomsLobbyRepository.findActiveRoomForUser(userId);

    if (activeRoom) {
      throw new ConflictException('You are already in an active room');
    }
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
  ) {
    const players = await this.roomsLobbyRepository.listPlayers(roomId);

    return {
      ...room,
      players,
    };
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

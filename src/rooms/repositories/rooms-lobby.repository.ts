import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import { roomPlayers, rooms, users } from '../../infra/database/schema';
import { ACTIVE_ROOM_STATUSES, ROOM_MAX_PLAYERS } from '../rooms.constants';

@Injectable()
export class RoomsLobbyRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async findActiveRoomForUser(userId: string) {
    const [room] = await this.databaseService.db
      .select({
        id: rooms.id,
        code: rooms.code,
        status: rooms.status,
      })
      .from(roomPlayers)
      .innerJoin(rooms, eq(rooms.id, roomPlayers.roomId))
      .where(
        and(
          eq(roomPlayers.userId, userId),
          eq(roomPlayers.status, 'joined'),
          inArray(rooms.status, ACTIVE_ROOM_STATUSES),
        ),
      )
      .limit(1);

    return room ?? null;
  }

  async createRoom(
    input: {
      code: string;
      hostUserId: string;
      durationMinutes: number;
      boardKey: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [room] = await db
      .insert(rooms)
      .values({
        code: input.code,
        hostUserId: input.hostUserId,
        durationMinutes: input.durationMinutes,
        boardKey: input.boardKey,
        maxPlayers: ROOM_MAX_PLAYERS,
      })
      .returning({
        id: rooms.id,
        code: rooms.code,
        hostUserId: rooms.hostUserId,
        status: rooms.status,
        maxPlayers: rooms.maxPlayers,
        durationMinutes: rooms.durationMinutes,
        boardKey: rooms.boardKey,
        createdAt: rooms.createdAt,
        startedAt: rooms.startedAt,
        endedAt: rooms.endedAt,
      });

    return room;
  }

  async addHumanPlayer(
    input: {
      roomId: string;
      userId: string;
      seatNumber: number;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [player] = await db
      .insert(roomPlayers)
      .values({
        roomId: input.roomId,
        userId: input.userId,
        playerType: 'human',
        seatNumber: input.seatNumber,
        status: 'joined',
      })
      .returning({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        playerType: roomPlayers.playerType,
        seatNumber: roomPlayers.seatNumber,
        status: roomPlayers.status,
        joinedAt: roomPlayers.joinedAt,
        leftAt: roomPlayers.leftAt,
      });

    return player;
  }

  async findRoomByCode(code: string) {
    const [room] = await this.databaseService.db
      .select({
        id: rooms.id,
        code: rooms.code,
        hostUserId: rooms.hostUserId,
        status: rooms.status,
        maxPlayers: rooms.maxPlayers,
        durationMinutes: rooms.durationMinutes,
        boardKey: rooms.boardKey,
        createdAt: rooms.createdAt,
        startedAt: rooms.startedAt,
        endedAt: rooms.endedAt,
      })
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);

    return room ?? null;
  }

  async listLiveRooms(limit: number) {
    return this.databaseService.db
      .select({
        id: rooms.id,
        code: rooms.code,
        hostUserId: rooms.hostUserId,
        status: rooms.status,
        maxPlayers: rooms.maxPlayers,
        durationMinutes: rooms.durationMinutes,
        boardKey: rooms.boardKey,
        createdAt: rooms.createdAt,
        startedAt: rooms.startedAt,
        endedAt: rooms.endedAt,
      })
      .from(rooms)
      .where(inArray(rooms.status, ACTIVE_ROOM_STATUSES))
      .orderBy(desc(rooms.createdAt))
      .limit(limit);
  }

  async listPlayers(roomId: string) {
    return this.databaseService.db
      .select({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        username: users.username,
        playerType: roomPlayers.playerType,
        botDifficulty: roomPlayers.botDifficulty,
        botName: roomPlayers.botName,
        seatNumber: roomPlayers.seatNumber,
        status: roomPlayers.status,
        joinedAt: roomPlayers.joinedAt,
        leftAt: roomPlayers.leftAt,
      })
      .from(roomPlayers)
      .leftJoin(users, eq(users.id, roomPlayers.userId))
      .where(eq(roomPlayers.roomId, roomId))
      .orderBy(roomPlayers.seatNumber);
  }

  async listJoinedPlayers(roomId: string) {
    return this.databaseService.db
      .select({
        id: roomPlayers.id,
        userId: roomPlayers.userId,
        seatNumber: roomPlayers.seatNumber,
      })
      .from(roomPlayers)
      .where(
        and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.status, 'joined')),
      )
      .orderBy(roomPlayers.seatNumber);
  }

  async findJoinedPlayer(roomId: string, userId: string) {
    const [player] = await this.databaseService.db
      .select({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        seatNumber: roomPlayers.seatNumber,
        status: roomPlayers.status,
      })
      .from(roomPlayers)
      .where(
        and(
          eq(roomPlayers.roomId, roomId),
          eq(roomPlayers.userId, userId),
          eq(roomPlayers.status, 'joined'),
        ),
      )
      .limit(1);

    return player ?? null;
  }

  async leaveRoom(
    input: {
      roomId: string;
      userId: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [player] = await db
      .update(roomPlayers)
      .set({
        status: 'left',
        leftAt: new Date(),
      })
      .where(
        and(
          eq(roomPlayers.roomId, input.roomId),
          eq(roomPlayers.userId, input.userId),
          eq(roomPlayers.status, 'joined'),
        ),
      )
      .returning({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        seatNumber: roomPlayers.seatNumber,
        status: roomPlayers.status,
      });

    return player ?? null;
  }

  async cancelRoom(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [room] = await db
      .update(rooms)
      .set({
        status: 'cancelled',
        endedAt: new Date(),
      })
      .where(and(eq(rooms.id, roomId), eq(rooms.status, 'waiting')))
      .returning({
        id: rooms.id,
        code: rooms.code,
        hostUserId: rooms.hostUserId,
        status: rooms.status,
        maxPlayers: rooms.maxPlayers,
        durationMinutes: rooms.durationMinutes,
        boardKey: rooms.boardKey,
        createdAt: rooms.createdAt,
        startedAt: rooms.startedAt,
        endedAt: rooms.endedAt,
      });

    return room ?? null;
  }

  isRoomCodeUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }

  isSeatUniqueViolation(error: unknown) {
    return this.isRoomCodeUniqueViolation(error);
  }
}

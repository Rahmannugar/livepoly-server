import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import {
  friendships,
  games,
  roomPlayers,
  rooms,
  users,
  roomSpectators,
} from '../../infra/database/schema';
import { ACTIVE_ROOM_STATUSES, ROOM_MAX_PLAYERS } from '../rooms.constants';

@Injectable()
export class RoomsLobbyRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
  }

  async lockActiveRoomMembershipForUser(
    userId: string,
    executor: DatabaseExecutor,
  ): Promise<void> {
    await executor.execute(sql`
      select pg_advisory_xact_lock(hashtext(${`active-room:${userId}`}))
    `);
  }

  async findActiveRoomForUser(userId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [room] = await db
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

  async findActiveUserByUsername(username: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
      })
      .from(users)
      .where(
        and(
          eq(users.username, username),
          eq(users.status, 'active'),
          eq(users.emailVerified, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return user ?? null;
  }

  async findActiveUserById(userId: string) {
    const [user] = await this.databaseService.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        avatarObjectKey: users.avatarObjectKey,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return user ?? null;
  }

  async findAcceptedFriendship(userAId: string, userBId: string) {
    const [friendship] = await this.databaseService.db
      .select({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            and(
              eq(friendships.requesterId, userAId),
              eq(friendships.addresseeId, userBId),
            ),
            and(
              eq(friendships.requesterId, userBId),
              eq(friendships.addresseeId, userAId),
            ),
          ),
        ),
      )
      .limit(1);

    return friendship ?? null;
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

  async findActiveGameByRoomId(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [game] = await db
      .select({
        id: games.id,
        roomId: games.roomId,
        status: games.status,
        expiresAt: games.expiresAt,
      })
      .from(games)
      .where(and(eq(games.roomId, roomId), eq(games.status, 'active')))
      .limit(1);

    return game ?? null;
  }

  async listActiveGamesForRooms(roomIds: string[]) {
    if (roomIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select({
        id: games.id,
        roomId: games.roomId,
        status: games.status,
        expiresAt: games.expiresAt,
      })
      .from(games)
      .where(and(inArray(games.roomId, roomIds), eq(games.status, 'active')));
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
      .where(
        and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.status, 'joined')),
      )
      .orderBy(roomPlayers.seatNumber);
  }

  async listPlayersForRooms(roomIds: string[]) {
    if (roomIds.length === 0) return [];

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
      .where(
        and(
          inArray(roomPlayers.roomId, roomIds),
          eq(roomPlayers.status, 'joined'),
        ),
      )
      .orderBy(roomPlayers.roomId, roomPlayers.seatNumber);
  }

  async listJoinedPlayers(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    return db
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

  async findPlayer(roomId: string, userId: string) {
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
        and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)),
      )
      .limit(1);

    return player ?? null;
  }

  async countJoinedHumanPlayers(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [result] = await db
      .select({ value: count() })
      .from(roomPlayers)
      .where(
        and(
          eq(roomPlayers.roomId, roomId),
          eq(roomPlayers.playerType, 'human'),
          eq(roomPlayers.status, 'joined'),
        ),
      );

    return result?.value ?? 0;
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

  async expireWaitingRooms(cutoff: Date, executor?: DatabaseExecutor) {
    const db = this.executor(executor);
    const now = new Date();

    return db
      .update(rooms)
      .set({
        status: 'cancelled',
        endedAt: now,
      })
      .where(and(eq(rooms.status, 'waiting'), lte(rooms.createdAt, cutoff)))
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
  }

  async lockRoomByCode(code: string, executor: DatabaseExecutor) {
    const [room] = await executor
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
      .limit(1)
      .for('update');

    return room ?? null;
  }

  async findCurrentSpectator(roomId: string, userId: string) {
    const [spectator] = await this.databaseService.db
      .select({
        id: roomSpectators.id,
        roomId: roomSpectators.roomId,
        userId: roomSpectators.userId,
        joinedAt: roomSpectators.joinedAt,
        leftAt: roomSpectators.leftAt,
      })
      .from(roomSpectators)
      .where(
        and(
          eq(roomSpectators.roomId, roomId),
          eq(roomSpectators.userId, userId),
          isNull(roomSpectators.leftAt),
        ),
      )
      .limit(1);

    return spectator ?? null;
  }

  async countCurrentSpectatorsForRooms(roomIds: string[]) {
    if (roomIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select({
        roomId: roomSpectators.roomId,
        value: count(),
      })
      .from(roomSpectators)
      .where(
        and(
          inArray(roomSpectators.roomId, roomIds),
          isNull(roomSpectators.leftAt),
        ),
      )
      .groupBy(roomSpectators.roomId);
  }

  async listCurrentSpectatorsForUserRoomIds(userId: string, roomIds: string[]) {
    if (roomIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select({
        roomId: roomSpectators.roomId,
      })
      .from(roomSpectators)
      .where(
        and(
          eq(roomSpectators.userId, userId),
          inArray(roomSpectators.roomId, roomIds),
          isNull(roomSpectators.leftAt),
        ),
      );
  }

  async countCurrentSpectators(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [result] = await db
      .select({ value: count() })
      .from(roomSpectators)
      .where(
        and(eq(roomSpectators.roomId, roomId), isNull(roomSpectators.leftAt)),
      );

    return result?.value ?? 0;
  }

  async createSpectator(
    input: {
      roomId: string;
      userId: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [spectator] = await db
      .insert(roomSpectators)
      .values({
        roomId: input.roomId,
        userId: input.userId,
      })
      .returning({
        id: roomSpectators.id,
        roomId: roomSpectators.roomId,
        userId: roomSpectators.userId,
        joinedAt: roomSpectators.joinedAt,
        leftAt: roomSpectators.leftAt,
      });

    return spectator;
  }

  async endSpectatorSession(input: { roomId: string; userId: string }) {
    const [spectator] = await this.databaseService.db
      .update(roomSpectators)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(roomSpectators.roomId, input.roomId),
          eq(roomSpectators.userId, input.userId),
          isNull(roomSpectators.leftAt),
        ),
      )
      .returning({
        id: roomSpectators.id,
        roomId: roomSpectators.roomId,
        userId: roomSpectators.userId,
        joinedAt: roomSpectators.joinedAt,
        leftAt: roomSpectators.leftAt,
      });

    return spectator ?? null;
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

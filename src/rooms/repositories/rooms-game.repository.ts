import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../infra/database/database.service';
import type { DatabaseExecutor } from '../../infra/database/database.service';
import { games, roomPlayers, rooms, users } from '../../infra/database/schema';
import type { BotDifficulty } from '../rooms.constants';

type CreateGameInput = {
  roomId: string;
  mode: 'ranked' | 'casual';
  currentTurnRoomPlayerId: string;
  state: unknown;
  expiresAt: Date;
};

@Injectable()
export class RoomsGameRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private executor(executor?: DatabaseExecutor): DatabaseExecutor {
    return executor ?? this.databaseService.db;
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

  async listJoinedPlayers(roomId: string) {
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

  async addBotPlayer(
    input: {
      roomId: string;
      seatNumber: number;
      botName: string;
      botDifficulty: BotDifficulty;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = this.executor(executor);

    const [player] = await db
      .insert(roomPlayers)
      .values({
        roomId: input.roomId,
        userId: null,
        playerType: 'bot',
        botName: input.botName,
        botDifficulty: input.botDifficulty,
        seatNumber: input.seatNumber,
        status: 'joined',
      })
      .returning({
        id: roomPlayers.id,
        roomId: roomPlayers.roomId,
        userId: roomPlayers.userId,
        username: sql<string | null>`null`,
        playerType: roomPlayers.playerType,
        botDifficulty: roomPlayers.botDifficulty,
        botName: roomPlayers.botName,
        seatNumber: roomPlayers.seatNumber,
        status: roomPlayers.status,
        joinedAt: roomPlayers.joinedAt,
        leftAt: roomPlayers.leftAt,
      });

    return player;
  }

  async startRoom(roomId: string, executor?: DatabaseExecutor) {
    const db = this.executor(executor);
    const now = new Date();

    const [room] = await db
      .update(rooms)
      .set({
        status: 'active',
        startedAt: now,
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

  async createGame(input: CreateGameInput, executor?: DatabaseExecutor) {
    const db = this.executor(executor);

    const [game] = await db
      .insert(games)
      .values({
        roomId: input.roomId,
        mode: input.mode,
        currentTurnRoomPlayerId: input.currentTurnRoomPlayerId,
        state: input.state,
        expiresAt: input.expiresAt,
      })
      .returning({
        id: games.id,
        roomId: games.roomId,
        mode: games.mode,
        status: games.status,
        currentTurnRoomPlayerId: games.currentTurnRoomPlayerId,
        turnNumber: games.turnNumber,
        state: games.state,
        startedAt: games.startedAt,
        expiresAt: games.expiresAt,
        finishedAt: games.finishedAt,
        createdAt: games.createdAt,
        updatedAt: games.updatedAt,
      });

    return game;
  }

  isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}

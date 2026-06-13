import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import { createInitialDeckState } from '../../game/engine/game-engine-cards';
import { createInitialPropertyState } from '../../game/engine/game-engine-properties';
import type { GameEngineState } from '../../game/engine/game-engine.types';
import { GAME_TURN_TIMER } from '../../game/game.constants';
import { GameSnapshotService } from '../../game/snapshots/game-snapshots.service';
import { GameStateService } from '../../game/state/game-state.service';
import { GameTurnTimerQueueService } from '../../game/timers/game-turn-timer-queue.service';
import { DatabaseService } from '../../infra/database/database.service';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import { RoomsGameRepository } from '../repositories/rooms-game.repository';
import {
  BOT_NAMES,
  DEFAULT_BOT_DIFFICULTY,
  ROOM_BOARD_KEY,
  ROOM_EVENTS,
  ROOM_METRICS,
  ROOM_MAX_PLAYERS,
  ROOM_MIN_RANKED_HUMANS,
  STARTING_CASH,
} from '../rooms.constants';

type JoinedRoomPlayer = Awaited<
  ReturnType<RoomsGameRepository['listJoinedPlayers']>
>[number];

type GameMode = 'ranked' | 'casual';

type BotPlayerInput = {
  roomId: string;
  seatNumber: number;
  botName: string;
  botDifficulty: typeof DEFAULT_BOT_DIFFICULTY;
};

@Injectable()
export class RoomsGameService {
  constructor(
    private readonly roomsGameRepository: RoomsGameRepository,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxQueueService: OutboxQueueService,
    private readonly gameStateService: GameStateService,
    private readonly observabilityService: ObservabilityService,
    private readonly gameSnapshotService: GameSnapshotService,
    private readonly gameTurnTimerQueueService: GameTurnTimerQueueService,
  ) {}

  async startRoom(authUser: AuthUser, code: string) {
    const room = await this.roomsGameRepository.findRoomByCode(code);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new ConflictException('Room is not open');
    }

    if (room.hostUserId !== authUser.id) {
      throw new ForbiddenException('Only the host can start the room');
    }

    const hostPlayer = await this.roomsGameRepository.findJoinedPlayer(
      room.id,
      authUser.id,
    );

    if (!hostPlayer) {
      throw new NotFoundException('Room player not found');
    }

    const joinedPlayers = await this.roomsGameRepository.listJoinedPlayers(
      room.id,
    );

    if (joinedPlayers.length === 0) {
      throw new ConflictException('Room has no joined players');
    }

    const humanPlayers = joinedPlayers.filter(
      (player) => player.playerType === 'human',
    );

    const hasOnlyHumans = joinedPlayers.every(
      (player) => player.playerType === 'human',
    );

    const mode: GameMode =
      hasOnlyHumans && humanPlayers.length >= ROOM_MIN_RANKED_HUMANS
        ? 'ranked'
        : 'casual';

    const botPlayers =
      mode === 'casual' ? this.buildBotPlayers(room.id, joinedPlayers) : [];

    const result = await this.databaseService.transaction(async (tx) => {
      const createdBots: JoinedRoomPlayer[] = [];

      for (const bot of botPlayers) {
        const createdBot = await this.roomsGameRepository.addBotPlayer(bot, tx);
        createdBots.push(createdBot);
      }

      const allPlayers = [...joinedPlayers, ...createdBots].sort(
        (left, right) => left.seatNumber - right.seatNumber,
      );

      const activeRoom = await this.roomsGameRepository.startRoom(room.id, tx);

      if (!activeRoom) {
        throw new ConflictException('Room is not open');
      }

      const initialState = this.createInitialGameState({
        roomId: room.id,
        roomCode: room.code,
        startedAt: activeRoom.startedAt,
        durationMinutes: activeRoom.durationMinutes,
        mode,
        players: allPlayers,
      });

      const game = await this.roomsGameRepository.createGame(
        {
          roomId: room.id,
          mode,
          currentTurnRoomPlayerId: allPlayers[0].id,
          state: initialState,
          expiresAt: new Date(initialState.expiresAt ?? Date.now()),
        },
        tx,
      );

      await this.gameSnapshotService.createStartSnapshot(
        game.id,
        initialState,
        tx,
      );

      const outboxEventIds: string[] = [];

      for (const player of humanPlayers) {
        if (!player.userId) continue;

        const notificationResult =
          await this.notificationsService.createGameStartedNotification(
            {
              userId: player.userId,
              roomId: room.id,
              roomCode: room.code,
              gameId: game.id,
            },
            tx,
          );

        outboxEventIds.push(notificationResult.outboxEventId);
      }

      return {
        room: activeRoom,
        game,
        players: allPlayers,
        outboxEventIds,
        initialState,
      };
    });

    await this.gameStateService.set(result.game.id, result.initialState);
    await this.gameTurnTimerQueueService.enqueueTurnTimer(
      result.game.id,
      result.initialState,
    );
    await this.gameTurnTimerQueueService.enqueueGameExpiry(
      result.game.id,
      result.initialState.expiresAt ?? Date.now(),
    );

    this.observabilityService.recordEvent(ROOM_EVENTS.started, {
      roomId: result.room.id,
      roomCode: result.room.code,
      gameId: result.game.id,
      hostUserId: authUser.id,
      mode,
      playerCount: result.players.length,
      humanPlayerCount: humanPlayers.length,
      botPlayerCount: result.players.length - humanPlayers.length,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.started(mode));

    for (const outboxEventId of result.outboxEventIds) {
      await this.outboxQueueService.enqueuePublishEvent(outboxEventId);
    }

    return {
      room: {
        ...result.room,
        currentUserAccess: 'player',
        players: result.players,
      },
      game: result.game,
    };
  }

  private buildBotPlayers(
    roomId: string,
    joinedPlayers: JoinedRoomPlayer[],
  ): BotPlayerInput[] {
    const occupiedSeats = new Set(
      joinedPlayers.map((player) => player.seatNumber),
    );
    const bots: BotPlayerInput[] = [];

    for (let seatNumber = 1; seatNumber <= ROOM_MAX_PLAYERS; seatNumber += 1) {
      if (occupiedSeats.has(seatNumber)) continue;

      bots.push({
        roomId,
        seatNumber,
        botName: BOT_NAMES[(seatNumber - 1) % BOT_NAMES.length],
        botDifficulty: DEFAULT_BOT_DIFFICULTY,
      });
    }

    return bots;
  }

  private createInitialGameState(input: {
    roomId: string;
    roomCode: string;
    startedAt: Date | null;
    durationMinutes: number;
    mode: GameMode;
    players: JoinedRoomPlayer[];
  }): GameEngineState {
    const startedAt = input.startedAt?.getTime() ?? Date.now();
    const expiresAt = startedAt + input.durationMinutes * 60 * 1000;

    const state: GameEngineState = {
      version: 1,
      roomId: input.roomId,
      roomCode: input.roomCode,
      boardKey: ROOM_BOARD_KEY,
      mode: input.mode,
      startedAt,
      durationMinutes: input.durationMinutes,
      expiresAt,
      turnExpiresAt: Math.min(startedAt + GAME_TURN_TIMER.timeoutMs, expiresAt),
      phase: 'awaiting_first_turn',
      turnNumber: 1,
      currentTurnRoomPlayerId: input.players[0].id,
      consecutiveDoublesCount: 0,
      shouldCurrentPlayerPlayAgain: false,
      lastDiceRoll: null,
      pendingTileKey: null,
      auction: null,
      debt: null,
      decks: createInitialDeckState({
        seed: input.roomId,
      }),
      players: input.players.map((player) => ({
        roomPlayerId: player.id,
        userId: player.userId,
        username: player.username,
        playerType: player.playerType,
        botDifficulty: player.botDifficulty,
        botName: player.botName,
        seatNumber: player.seatNumber,
        cash: STARTING_CASH,
        position: 0,
        inJail: false,
        jailTurnCount: 0,
        getOutOfJailFreeCards: 0,
        consecutiveMissedTurns: 0,
        lastMissedTurnNumber: null,
        bankrupt: false,
      })),
      properties: [],
    };

    return {
      ...state,
      properties: createInitialPropertyState(state),
    };
  }
}

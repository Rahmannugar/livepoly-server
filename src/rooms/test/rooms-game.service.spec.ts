import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import { RoomsGameService } from '../services/rooms-game.service';
import type { GameStateService } from '../../game/state/game-state.service';
import type { RoomsGameRepository } from '../repositories/rooms-game.repository';
import { ROOM_EVENTS, ROOM_METRICS } from '../rooms.constants';

type RoomsGameRepositoryMock = {
  findRoomByCode: jest.Mock;
  findJoinedPlayer: jest.Mock;
  listJoinedPlayers: jest.Mock;
  addBotPlayer: jest.Mock;
  startRoom: jest.Mock;
  createGame: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

type NotificationsServiceMock = {
  createGameStartedNotification: jest.Mock;
};

type OutboxQueueServiceMock = {
  enqueuePublishEvent: jest.Mock;
};

type GameStateServiceMock = {
  set: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  sessionId: 'session-1',
  tokenVersion: 0,
};

const createdAt = new Date('2026-05-14T12:00:00.000Z');

const waitingRoom = {
  id: 'room-1',
  code: 'AbC23xYz',
  hostUserId: authUser.id,
  status: 'waiting' as const,
  maxPlayers: 4,
  durationMinutes: 60,
  boardKey: 'classic',
  createdAt,
  startedAt: null,
  endedAt: null,
};

const activeRoom = {
  ...waitingRoom,
  status: 'active' as const,
  startedAt: new Date('2026-05-14T12:05:00.000Z'),
};

const humanPlayerOne = {
  id: 'room-player-1',
  roomId: waitingRoom.id,
  userId: 'user-1',
  username: 'playerone',
  playerType: 'human' as const,
  botDifficulty: null,
  botName: null,
  seatNumber: 1,
  status: 'joined' as const,
  joinedAt: createdAt,
  leftAt: null,
};

const humanPlayerTwo = {
  id: 'room-player-2',
  roomId: waitingRoom.id,
  userId: 'user-2',
  username: 'playertwo',
  playerType: 'human' as const,
  botDifficulty: null,
  botName: null,
  seatNumber: 2,
  status: 'joined' as const,
  joinedAt: createdAt,
  leftAt: null,
};

const humanPlayerThree = {
  id: 'room-player-3',
  roomId: waitingRoom.id,
  userId: 'user-3',
  username: 'playerthree',
  playerType: 'human' as const,
  botDifficulty: null,
  botName: null,
  seatNumber: 3,
  status: 'joined' as const,
  joinedAt: createdAt,
  leftAt: null,
};

let gameStateService: GameStateServiceMock;
let observabilityService: ObservabilityServiceMock;

describe('RoomsGameService', () => {
  let service: RoomsGameService;
  let roomsGameRepository: RoomsGameRepositoryMock;
  let databaseService: DatabaseServiceMock;
  let notificationsService: NotificationsServiceMock;
  let outboxQueueService: OutboxQueueServiceMock;

  const tx = { tx: true };

  beforeEach(() => {
    roomsGameRepository = {
      findRoomByCode: jest.fn(),
      findJoinedPlayer: jest.fn(),
      listJoinedPlayers: jest.fn(),
      addBotPlayer: jest.fn(),
      startRoom: jest.fn(),
      createGame: jest.fn(),
    };

    databaseService = {
      transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
    };

    notificationsService = {
      createGameStartedNotification: jest
        .fn()
        .mockResolvedValueOnce({
          notification: { id: 'notification-1' },
          outboxEventId: 'outbox-1',
        })
        .mockResolvedValueOnce({
          notification: { id: 'notification-2' },
          outboxEventId: 'outbox-2',
        })
        .mockResolvedValueOnce({
          notification: { id: 'notification-3' },
          outboxEventId: 'outbox-3',
        }),
    };

    outboxQueueService = {
      enqueuePublishEvent: jest.fn().mockResolvedValue(undefined),
    };

    gameStateService = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    service = new RoomsGameService(
      roomsGameRepository as unknown as RoomsGameRepository,
      databaseService as unknown as DatabaseService,
      notificationsService as unknown as NotificationsService,
      outboxQueueService as unknown as OutboxQueueService,
      gameStateService as unknown as GameStateService,
      observabilityService as unknown as ObservabilityService,
    );
  });

  it('starts a ranked game with three humans and does not add bots', async () => {
    const players = [humanPlayerOne, humanPlayerTwo, humanPlayerThree];

    roomsGameRepository.findRoomByCode.mockResolvedValue(waitingRoom);
    roomsGameRepository.findJoinedPlayer.mockResolvedValue(humanPlayerOne);
    roomsGameRepository.listJoinedPlayers.mockResolvedValue(players);
    roomsGameRepository.startRoom.mockResolvedValue(activeRoom);
    roomsGameRepository.createGame.mockResolvedValue({
      id: 'game-1',
      roomId: waitingRoom.id,
      mode: 'ranked' as const,
      status: 'active' as const,
      currentTurnRoomPlayerId: humanPlayerOne.id,
      turnNumber: 1,
      state: {
        version: 1,
        mode: 'ranked',
      },
      startedAt: activeRoom.startedAt,
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.startRoom(authUser, waitingRoom.code);

    expect(roomsGameRepository.addBotPlayer).not.toHaveBeenCalled();

    expect(roomsGameRepository.startRoom).toHaveBeenCalledWith(
      waitingRoom.id,
      tx,
    );

    expect(roomsGameRepository.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: waitingRoom.id,
        mode: 'ranked',
        currentTurnRoomPlayerId: humanPlayerOne.id,
        state: expect.objectContaining({
          version: 1,
          roomId: waitingRoom.id,
          roomCode: waitingRoom.code,
          boardKey: 'classic',
          mode: 'ranked',
          phase: 'awaiting_first_turn',
          turnNumber: 1,
          currentTurnRoomPlayerId: humanPlayerOne.id,
          lastDiceRoll: null,
          players: expect.arrayContaining([
            expect.objectContaining({
              roomPlayerId: humanPlayerOne.id,
              playerType: 'human',
              cash: 1500,
              position: 0,
            }),
          ]),
        }),
      }),
      tx,
    );

    expect(
      notificationsService.createGameStartedNotification,
    ).toHaveBeenCalledTimes(3);

    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-1',
    );
    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-2',
    );
    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-3',
    );

    expect(gameStateService.set).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        version: 1,
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        boardKey: 'classic',
        mode: 'ranked',
        phase: 'awaiting_first_turn',
        turnNumber: 1,
        currentTurnRoomPlayerId: humanPlayerOne.id,
        lastDiceRoll: null,
      }),
    );
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.started,
      {
        roomId: activeRoom.id,
        roomCode: activeRoom.code,
        gameId: 'game-1',
        hostUserId: authUser.id,
        mode: 'ranked',
        playerCount: 3,
        humanPlayerCount: 3,
        botPlayerCount: 0,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.started('ranked'),
    );

    expect(result.room).toEqual({
      ...activeRoom,
      players,
    });
    expect(result.game).toEqual(
      expect.objectContaining({
        id: 'game-1',
        mode: 'ranked',
      }),
    );
  });

  it('starts a casual game with fewer than three humans and fills empty seats with bots', async () => {
    const players = [humanPlayerOne];

    const botTwo = {
      id: 'bot-player-2',
      roomId: waitingRoom.id,
      userId: null,
      username: null,
      playerType: 'bot' as const,
      botDifficulty: 'normal' as const,
      botName: 'Nova',
      seatNumber: 2,
      status: 'joined' as const,
      joinedAt: createdAt,
      leftAt: null,
    };

    const botThree = {
      ...botTwo,
      id: 'bot-player-3',
      botName: 'Midas',
      seatNumber: 3,
    };

    const botFour = {
      ...botTwo,
      id: 'bot-player-4',
      botName: 'Echo',
      seatNumber: 4,
    };

    roomsGameRepository.findRoomByCode.mockResolvedValue(waitingRoom);
    roomsGameRepository.findJoinedPlayer.mockResolvedValue(humanPlayerOne);
    roomsGameRepository.listJoinedPlayers.mockResolvedValue(players);
    roomsGameRepository.addBotPlayer
      .mockResolvedValueOnce(botTwo)
      .mockResolvedValueOnce(botThree)
      .mockResolvedValueOnce(botFour);
    roomsGameRepository.startRoom.mockResolvedValue(activeRoom);
    roomsGameRepository.createGame.mockResolvedValue({
      id: 'game-1',
      roomId: waitingRoom.id,
      mode: 'casual' as const,
      status: 'active' as const,
      currentTurnRoomPlayerId: humanPlayerOne.id,
      turnNumber: 1,
      state: {
        version: 1,
        mode: 'casual',
      },
      startedAt: activeRoom.startedAt,
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.startRoom(authUser, waitingRoom.code);

    expect(roomsGameRepository.addBotPlayer).toHaveBeenCalledTimes(3);

    expect(roomsGameRepository.addBotPlayer).toHaveBeenCalledWith(
      {
        roomId: waitingRoom.id,
        seatNumber: 2,
        botName: 'Nova',
        botDifficulty: 'normal',
      },
      tx,
    );

    expect(roomsGameRepository.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'casual',
        currentTurnRoomPlayerId: humanPlayerOne.id,
        state: expect.objectContaining({
          version: 1,
          roomId: waitingRoom.id,
          roomCode: waitingRoom.code,
          boardKey: 'classic',
          mode: 'casual',
          phase: 'awaiting_first_turn',
          turnNumber: 1,
          currentTurnRoomPlayerId: humanPlayerOne.id,
          lastDiceRoll: null,
          players: expect.arrayContaining([
            expect.objectContaining({
              roomPlayerId: humanPlayerOne.id,
              playerType: 'human',
              seatNumber: 1,
              cash: 1500,
              position: 0,
            }),
            expect.objectContaining({
              roomPlayerId: botTwo.id,
              playerType: 'bot',
              botName: 'Nova',
              botDifficulty: 'normal',
              seatNumber: 2,
              cash: 1500,
            }),
            expect.objectContaining({
              roomPlayerId: botThree.id,
              playerType: 'bot',
              botName: 'Midas',
              botDifficulty: 'normal',
              seatNumber: 3,
              cash: 1500,
            }),
            expect.objectContaining({
              roomPlayerId: botFour.id,
              playerType: 'bot',
              botName: 'Echo',
              botDifficulty: 'normal',
              seatNumber: 4,
              cash: 1500,
            }),
          ]),
        }),
      }),
      tx,
    );

    expect(
      notificationsService.createGameStartedNotification,
    ).toHaveBeenCalledTimes(1);
    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-1',
    );

    expect(gameStateService.set).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        version: 1,
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        boardKey: 'classic',
        mode: 'casual',
        phase: 'awaiting_first_turn',
        turnNumber: 1,
        currentTurnRoomPlayerId: humanPlayerOne.id,
        lastDiceRoll: null,
      }),
    );
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.started,
      {
        roomId: activeRoom.id,
        roomCode: activeRoom.code,
        gameId: 'game-1',
        hostUserId: authUser.id,
        mode: 'casual',
        playerCount: 4,
        humanPlayerCount: 1,
        botPlayerCount: 3,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.started('casual'),
    );

    expect(result.room.players).toHaveLength(4);
    expect(result.game).toEqual(
      expect.objectContaining({
        id: 'game-1',
        mode: 'casual',
      }),
    );
  });

  it('rejects non-host start attempts', async () => {
    roomsGameRepository.findRoomByCode.mockResolvedValue({
      ...waitingRoom,
      hostUserId: 'other-user',
    });

    await expect(
      service.startRoom(authUser, waitingRoom.code),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
    expect(roomsGameRepository.createGame).not.toHaveBeenCalled();
    expect(
      notificationsService.createGameStartedNotification,
    ).not.toHaveBeenCalled();
  });

  it('rejects starting a room that is not waiting', async () => {
    roomsGameRepository.findRoomByCode.mockResolvedValue({
      ...waitingRoom,
      status: 'active' as const,
    });

    await expect(
      service.startRoom(authUser, waitingRoom.code),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
    expect(roomsGameRepository.createGame).not.toHaveBeenCalled();
  });
});

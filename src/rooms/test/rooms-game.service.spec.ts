import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { GameSnapshotService } from '../../game/snapshots/game-snapshots.service';
import type { GameStateService } from '../../game/state/game-state.service';
import type { GameTurnTimerQueueService } from '../../game/timers/game-turn-timer-queue.service';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { RoomsGameRepository } from '../repositories/rooms-game.repository';
import { BOT_NAMES, ROOM_EVENTS, ROOM_METRICS } from '../rooms.constants';
import { RoomsGameService } from '../services/rooms-game.service';
import type { RoomsStreamService } from '../services/rooms-stream.service';

type RoomsGameRepositoryMock = {
  lockRoomByCode: jest.Mock;
  findJoinedPlayer: jest.Mock;
  listJoinedPlayers: jest.Mock;
  addBotPlayer: jest.Mock;
  startRoom: jest.Mock;
  createGame: jest.Mock;
  cancelStartedGame: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

type GameStateServiceMock = {
  set: jest.Mock;
  delete: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

type GameSnapshotServiceMock = {
  createStartSnapshot: jest.Mock;
};

type GameTurnTimerQueueServiceMock = {
  enqueueTurnTimer: jest.Mock;
  enqueueGameExpiry: jest.Mock;
};

type RoomsStreamServiceMock = {
  publishRoomChanged: jest.Mock;
};

const authUser: AuthUser = {
  id: 'user-1',
  email: 'player@example.com',
  username: 'playerone',
  role: 'player',
  status: 'active',
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
  durationMinutes: 90,
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

describe('RoomsGameService', () => {
  let service: RoomsGameService;
  let roomsGameRepository: RoomsGameRepositoryMock;
  let databaseService: DatabaseServiceMock;
  let gameStateService: GameStateServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let gameSnapshotService: GameSnapshotServiceMock;
  let gameTurnTimerQueueService: GameTurnTimerQueueServiceMock;
  let roomsStreamService: RoomsStreamServiceMock;

  const tx = { tx: true };

  beforeEach(() => {
    roomsGameRepository = {
      lockRoomByCode: jest.fn(),
      findJoinedPlayer: jest.fn(),
      listJoinedPlayers: jest.fn(),
      addBotPlayer: jest.fn(),
      startRoom: jest.fn(),
      createGame: jest.fn(),
      cancelStartedGame: jest.fn(),
    };

    databaseService = {
      transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
    };

    gameStateService = {
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    gameSnapshotService = {
      createStartSnapshot: jest.fn().mockResolvedValue(undefined),
    };

    gameTurnTimerQueueService = {
      enqueueTurnTimer: jest.fn().mockResolvedValue(undefined),
      enqueueGameExpiry: jest.fn().mockResolvedValue(undefined),
    };

    roomsStreamService = {
      publishRoomChanged: jest.fn().mockResolvedValue(undefined),
    };

    service = new RoomsGameService(
      roomsGameRepository as unknown as RoomsGameRepository,
      databaseService as unknown as DatabaseService,
      gameStateService as unknown as GameStateService,
      observabilityService as unknown as ObservabilityService,
      gameSnapshotService as unknown as GameSnapshotService,
      gameTurnTimerQueueService as unknown as GameTurnTimerQueueService,
      roomsStreamService as unknown as RoomsStreamService,
    );
  });

  it('starts ranked game with three humans', async () => {
    const players = [humanPlayerOne, humanPlayerTwo, humanPlayerThree];

    roomsGameRepository.lockRoomByCode.mockResolvedValue(waitingRoom);
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
      expiresAt: new Date(activeRoom.startedAt.getTime() + 60 * 60 * 1000),
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
        expiresAt: new Date(activeRoom.startedAt.getTime() + 60 * 60 * 1000),
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
              consecutiveMissedTurns: 0,
            }),
          ]),
        }),
      }),
      tx,
    );

    expect(gameSnapshotService.createStartSnapshot).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        mode: 'ranked',
        phase: 'awaiting_first_turn',
        turnNumber: 1,
      }),
      tx,
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

    expect(gameTurnTimerQueueService.enqueueTurnTimer).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        phase: 'awaiting_first_turn',
        currentTurnRoomPlayerId: humanPlayerOne.id,
      }),
    );
    expect(gameTurnTimerQueueService.enqueueGameExpiry).toHaveBeenCalledWith(
      'game-1',
      activeRoom.startedAt.getTime() + 60 * 60 * 1000,
    );

    expect(result.room).toEqual({
      ...activeRoom,
      currentUserAccess: 'player',
      players,
    });
    expect(result.game).toEqual(
      expect.objectContaining({
        id: 'game-1',
        mode: 'ranked',
      }),
    );
  });

  it('uses the ranked duration for ranked games', async () => {
    const ninetyMinuteRoom = {
      ...waitingRoom,
      durationMinutes: 90,
    };
    const activeNinetyMinuteRoom = {
      ...ninetyMinuteRoom,
      status: 'active' as const,
      startedAt: activeRoom.startedAt,
    };
    const players = [humanPlayerOne, humanPlayerTwo, humanPlayerThree];
    const rankedExpiresAt = new Date(
      activeNinetyMinuteRoom.startedAt.getTime() + 60 * 60 * 1000,
    );

    roomsGameRepository.lockRoomByCode.mockResolvedValue(ninetyMinuteRoom);
    roomsGameRepository.findJoinedPlayer.mockResolvedValue(humanPlayerOne);
    roomsGameRepository.listJoinedPlayers.mockResolvedValue(players);
    roomsGameRepository.startRoom.mockResolvedValue(activeNinetyMinuteRoom);
    roomsGameRepository.createGame.mockResolvedValue({
      id: 'game-1',
      roomId: ninetyMinuteRoom.id,
      mode: 'ranked' as const,
      status: 'active' as const,
      currentTurnRoomPlayerId: humanPlayerOne.id,
      turnNumber: 1,
      state: {
        version: 1,
        mode: 'ranked',
      },
      startedAt: activeNinetyMinuteRoom.startedAt,
      expiresAt: rankedExpiresAt,
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    await service.startRoom(authUser, ninetyMinuteRoom.code);

    expect(roomsGameRepository.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'ranked',
        expiresAt: rankedExpiresAt,
        state: expect.objectContaining({
          mode: 'ranked',
          durationMinutes: 60,
          expiresAt: rankedExpiresAt.getTime(),
        }),
      }),
      tx,
    );
    expect(gameTurnTimerQueueService.enqueueGameExpiry).toHaveBeenCalledWith(
      'game-1',
      rankedExpiresAt.getTime(),
    );
  });

  it('cancels the started game when live setup fails after the database transaction', async () => {
    const players = [humanPlayerOne, humanPlayerTwo, humanPlayerThree];
    const game = {
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
      expiresAt: new Date(activeRoom.startedAt.getTime() + 90 * 60 * 1000),
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    roomsGameRepository.lockRoomByCode.mockResolvedValue(waitingRoom);
    roomsGameRepository.findJoinedPlayer.mockResolvedValue(humanPlayerOne);
    roomsGameRepository.listJoinedPlayers.mockResolvedValue(players);
    roomsGameRepository.startRoom.mockResolvedValue(activeRoom);
    roomsGameRepository.createGame.mockResolvedValue(game);
    gameTurnTimerQueueService.enqueueGameExpiry.mockRejectedValue(
      new Error('queue down'),
    );

    await expect(service.startRoom(authUser, waitingRoom.code)).rejects.toThrow(
      'Game could not be started',
    );

    expect(gameStateService.delete).toHaveBeenCalledWith(game.id);
    expect(roomsGameRepository.cancelStartedGame).toHaveBeenCalledWith(
      {
        roomId: waitingRoom.id,
        gameId: game.id,
        finishedAt: expect.any(Date),
      },
      tx,
    );
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.startSetupFailed,
      {
        roomId: activeRoom.id,
        roomCode: activeRoom.code,
        gameId: game.id,
        message: 'queue down',
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.startSetupFailed,
    );
  });

  it('starts casual game and fills seats with bots', async () => {
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

    roomsGameRepository.lockRoomByCode.mockResolvedValue(waitingRoom);
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
      expiresAt: new Date(activeRoom.startedAt.getTime() + 90 * 60 * 1000),
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.startRoom(authUser, waitingRoom.code);

    expect(roomsGameRepository.addBotPlayer).toHaveBeenCalledTimes(3);

    const addedBots = roomsGameRepository.addBotPlayer.mock.calls.map(
      ([bot]) => bot,
    );
    const addedBotNames = addedBots.map((bot) => bot.botName);

    expect(addedBots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: waitingRoom.id,
          seatNumber: 2,
          botDifficulty: 'normal',
        }),
      ]),
    );
    expect(new Set(addedBotNames).size).toBe(3);
    expect(addedBotNames.every((name) => BOT_NAMES.includes(name))).toBe(true);
    expect(addedBotNames).not.toEqual(['Nova', 'Midas', 'Echo']);

    expect(roomsGameRepository.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'casual',
        currentTurnRoomPlayerId: humanPlayerOne.id,
        expiresAt: new Date(activeRoom.startedAt.getTime() + 90 * 60 * 1000),
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
              consecutiveMissedTurns: 0,
            }),
            expect.objectContaining({
              roomPlayerId: botTwo.id,
              playerType: 'bot',
              botName: 'Nova',
              botDifficulty: 'normal',
              seatNumber: 2,
              cash: 1500,
              consecutiveMissedTurns: 0,
            }),
            expect.objectContaining({
              roomPlayerId: botThree.id,
              playerType: 'bot',
              botName: 'Midas',
              botDifficulty: 'normal',
              seatNumber: 3,
              cash: 1500,
              consecutiveMissedTurns: 0,
            }),
            expect.objectContaining({
              roomPlayerId: botFour.id,
              playerType: 'bot',
              botName: 'Echo',
              botDifficulty: 'normal',
              seatNumber: 4,
              cash: 1500,
              consecutiveMissedTurns: 0,
            }),
          ]),
        }),
      }),
      tx,
    );

    expect(gameSnapshotService.createStartSnapshot).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        mode: 'casual',
        phase: 'awaiting_first_turn',
        turnNumber: 1,
      }),
      tx,
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

    expect(result.room.players).toHaveLength(4);
    expect(result.game).toEqual(
      expect.objectContaining({
        id: 'game-1',
        mode: 'casual',
      }),
    );
  });

  it('uses requested bot difficulty when filling casual seats', async () => {
    const players = [humanPlayerOne];

    const botTwo = {
      id: 'bot-player-2',
      roomId: waitingRoom.id,
      userId: null,
      username: null,
      playerType: 'bot' as const,
      botDifficulty: 'hard' as const,
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

    roomsGameRepository.lockRoomByCode.mockResolvedValue(waitingRoom);
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
      expiresAt: new Date(activeRoom.startedAt.getTime() + 90 * 60 * 1000),
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    await service.startRoom(authUser, waitingRoom.code, {
      botDifficulty: 'hard',
    });

    expect(roomsGameRepository.addBotPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        seatNumber: 2,
        botName: expect.any(String),
        botDifficulty: 'hard',
      }),
      tx,
    );
  });

  it('starts casual game when joined players already include a bot', async () => {
    const botPlayer = {
      id: 'bot-player-4',
      roomId: waitingRoom.id,
      userId: null,
      username: null,
      playerType: 'bot' as const,
      botDifficulty: 'normal' as const,
      botName: 'Nova',
      seatNumber: 4,
      status: 'joined' as const,
      joinedAt: createdAt,
      leftAt: null,
    };

    const players = [
      humanPlayerOne,
      humanPlayerTwo,
      humanPlayerThree,
      botPlayer,
    ];

    roomsGameRepository.lockRoomByCode.mockResolvedValue(waitingRoom);
    roomsGameRepository.findJoinedPlayer.mockResolvedValue(humanPlayerOne);
    roomsGameRepository.listJoinedPlayers.mockResolvedValue(players);
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
      expiresAt: new Date(activeRoom.startedAt.getTime() + 90 * 60 * 1000),
      finishedAt: null,
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.startRoom(authUser, waitingRoom.code);

    expect(roomsGameRepository.addBotPlayer).not.toHaveBeenCalled();

    expect(roomsGameRepository.createGame).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'casual',
        state: expect.objectContaining({
          mode: 'casual',
          players: expect.arrayContaining([
            expect.objectContaining({
              roomPlayerId: botPlayer.id,
              playerType: 'bot',
            }),
          ]),
        }),
      }),
      tx,
    );

    expect(gameStateService.set).toHaveBeenCalledWith(
      'game-1',
      expect.objectContaining({
        mode: 'casual',
      }),
    );

    expect(result.game).toEqual(
      expect.objectContaining({
        mode: 'casual',
      }),
    );
  });

  it('rejects start from non-host', async () => {
    roomsGameRepository.lockRoomByCode.mockResolvedValue({
      ...waitingRoom,
      hostUserId: 'other-user',
    });

    await expect(
      service.startRoom(authUser, waitingRoom.code),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);
    expect(roomsGameRepository.lockRoomByCode).toHaveBeenCalledWith(
      waitingRoom.code,
      tx,
    );
    expect(roomsGameRepository.createGame).not.toHaveBeenCalled();
    expect(gameSnapshotService.createStartSnapshot).not.toHaveBeenCalled();
  });

  it('rejects starting a room that is not waiting', async () => {
    roomsGameRepository.lockRoomByCode.mockResolvedValue({
      ...waitingRoom,
      status: 'active' as const,
    });

    await expect(
      service.startRoom(authUser, waitingRoom.code),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);
    expect(roomsGameRepository.lockRoomByCode).toHaveBeenCalledWith(
      waitingRoom.code,
      tx,
    );
    expect(roomsGameRepository.createGame).not.toHaveBeenCalled();
    expect(gameSnapshotService.createStartSnapshot).not.toHaveBeenCalled();
  });
});

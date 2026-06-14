import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { GameCommandsService } from '../../game/commands/game-commands.service';
import type { GameEngineState } from '../../game/engine/game-engine.types';
import type { GameRecoveryService } from '../../game/recovery/game-recovery.service';
import type { GameResultsService } from '../../game/results/game-results.service';
import type { GameStateService } from '../../game/state/game-state.service';
import type { DatabaseService } from '../../infra/database/database.service';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { OutboxQueueService } from '../../outbox/jobs/outbox-queue.service';
import type { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import { ROOM_EVENTS, ROOM_METRICS } from '../rooms.constants';
import { RoomsLobbyService } from '../services/rooms-lobby.service';

type RoomsLobbyRepositoryMock = {
  findActiveRoomForUser: jest.Mock;
  createRoom: jest.Mock;
  addHumanPlayer: jest.Mock;
  findRoomByCode: jest.Mock;
  listLiveRooms: jest.Mock;
  listPlayers: jest.Mock;
  listPlayersForRooms: jest.Mock;
  listActiveGamesForRooms: jest.Mock;
  listJoinedPlayers: jest.Mock;
  findJoinedPlayer: jest.Mock;
  findPlayer: jest.Mock;
  leaveRoom: jest.Mock;
  cancelRoom: jest.Mock;
  countJoinedHumanPlayers: jest.Mock;
  findActiveGameByRoomId: jest.Mock;
  findActiveUserByUsername: jest.Mock;
  findActiveUserById: jest.Mock;
  findAcceptedFriendship: jest.Mock;
  isRoomCodeUniqueViolation: jest.Mock;
  isSeatUniqueViolation: jest.Mock;
  lockRoomByCode: jest.Mock;
  findCurrentSpectator: jest.Mock;
  listCurrentSpectatorsForUserRoomIds: jest.Mock;
  countCurrentSpectators: jest.Mock;
  createSpectator: jest.Mock;
  endSpectatorSession: jest.Mock;
  countCurrentSpectatorsForRooms: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
};

type NotificationsServiceMock = {
  createRoomInviteNotification: jest.Mock;
};

type OutboxQueueServiceMock = {
  enqueuePublishEvent: jest.Mock;
};

type ObservabilityServiceMock = {
  recordEvent: jest.Mock;
  recordMetric: jest.Mock;
};

type GameRecoveryServiceMock = {
  getOrRecover: jest.Mock;
};

type GameResultsServiceMock = {
  finalizeFinishedGame: jest.Mock;
  finalizeExpiredFinishedGame: jest.Mock;
};

type GameStateServiceMock = {
  set: jest.Mock;
};

type GameCommandsServiceMock = {
  executeIntent: jest.Mock;
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

const spectator = {
  id: 'spectator-1',
  roomId: activeRoom.id,
  userId: authUser.id,
  joinedAt: createdAt,
  leftAt: null,
};

const activeGameState: GameEngineState = {
  version: 1,
  roomId: activeRoom.id,
  roomCode: activeRoom.code,
  boardKey: 'classic',
  mode: 'casual',
  startedAt: activeRoom.startedAt.getTime(),
  durationMinutes: activeRoom.durationMinutes,
  expiresAt: activeRoom.startedAt.getTime() + 60 * 60 * 1000,
  phase: 'awaiting_roll',
  turnNumber: 1,
  currentTurnRoomPlayerId: 'player-1',
  consecutiveDoublesCount: 0,
  shouldCurrentPlayerPlayAgain: false,
  lastDiceRoll: null,
  pendingTileKey: null,
  auction: null,
  debt: null,
  decks: {
    chance: { drawPile: [], discardPile: [] },
    worldFund: { drawPile: [], discardPile: [] },
  },
  players: [
    {
      roomPlayerId: 'player-1',
      userId: authUser.id,
      username: authUser.username,
      playerType: 'human',
      botDifficulty: null,
      botName: null,
      seatNumber: 1,
      cash: 1500,
      position: 0,
      inJail: false,
      jailTurnCount: 0,
      getOutOfJailFreeCards: 0,
      consecutiveMissedTurns: 0,
      lastMissedTurnNumber: null,
      bankrupt: false,
    },
    {
      roomPlayerId: 'bot-1',
      userId: null,
      username: null,
      playerType: 'bot',
      botDifficulty: 'normal',
      botName: 'Nova',
      seatNumber: 2,
      cash: 1200,
      position: 4,
      inJail: false,
      jailTurnCount: 0,
      getOutOfJailFreeCards: 0,
      consecutiveMissedTurns: 0,
      lastMissedTurnNumber: null,
      bankrupt: false,
    },
  ],
  properties: [],
};

describe('RoomsLobbyService', () => {
  let service: RoomsLobbyService;
  let roomsLobbyRepository: RoomsLobbyRepositoryMock;
  let databaseService: DatabaseServiceMock;
  let notificationsService: NotificationsServiceMock;
  let outboxQueueService: OutboxQueueServiceMock;
  let observabilityService: ObservabilityServiceMock;
  let gameRecoveryService: GameRecoveryServiceMock;
  let gameResultsService: GameResultsServiceMock;
  let gameStateService: GameStateServiceMock;
  let gameCommandsService: GameCommandsServiceMock;

  const tx = { tx: true };

  beforeEach(() => {
    roomsLobbyRepository = {
      findActiveRoomForUser: jest.fn().mockResolvedValue(null),
      createRoom: jest.fn(),
      addHumanPlayer: jest.fn(),
      findRoomByCode: jest.fn(),
      listLiveRooms: jest.fn(),
      listPlayers: jest.fn().mockResolvedValue([]),
      listPlayersForRooms: jest.fn().mockResolvedValue([]),
      listActiveGamesForRooms: jest.fn().mockResolvedValue([]),
      listJoinedPlayers: jest.fn(),
      findJoinedPlayer: jest.fn(),
      findPlayer: jest.fn(),
      leaveRoom: jest.fn(),
      cancelRoom: jest.fn(),
      countJoinedHumanPlayers: jest.fn(),
      findActiveGameByRoomId: jest.fn(),
      findActiveUserByUsername: jest.fn(),
      findActiveUserById: jest.fn(),
      findAcceptedFriendship: jest.fn(),
      isRoomCodeUniqueViolation: jest.fn().mockReturnValue(false),
      isSeatUniqueViolation: jest.fn().mockReturnValue(false),
      lockRoomByCode: jest.fn(),
      findCurrentSpectator: jest.fn(),
      listCurrentSpectatorsForUserRoomIds: jest.fn().mockResolvedValue([]),
      countCurrentSpectators: jest.fn().mockResolvedValue(0),
      createSpectator: jest.fn(),
      endSpectatorSession: jest.fn(),
      countCurrentSpectatorsForRooms: jest.fn().mockResolvedValue([]),
    };

    databaseService = {
      transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
    };

    notificationsService = {
      createRoomInviteNotification: jest.fn(),
    };

    outboxQueueService = {
      enqueuePublishEvent: jest.fn().mockResolvedValue(undefined),
    };

    observabilityService = {
      recordEvent: jest.fn(),
      recordMetric: jest.fn(),
    };

    gameRecoveryService = {
      getOrRecover: jest.fn(),
    };

    gameResultsService = {
      finalizeFinishedGame: jest.fn().mockResolvedValue(undefined),
      finalizeExpiredFinishedGame: jest.fn().mockResolvedValue(undefined),
    };

    gameStateService = {
      set: jest.fn().mockResolvedValue(undefined),
    };

    gameCommandsService = {
      executeIntent: jest.fn().mockResolvedValue(undefined),
    };

    service = new RoomsLobbyService(
      roomsLobbyRepository as unknown as RoomsLobbyRepository,
      databaseService as unknown as DatabaseService,
      notificationsService as unknown as NotificationsService,
      outboxQueueService as unknown as OutboxQueueService,
      observabilityService as unknown as ObservabilityService,
      gameRecoveryService as unknown as GameRecoveryService,
      gameResultsService as unknown as GameResultsService,
      gameStateService as unknown as GameStateService,
      gameCommandsService as unknown as GameCommandsService,
    );
  });

  it('rejects creating a room when the user is already in a waiting or active room', async () => {
    roomsLobbyRepository.findActiveRoomForUser.mockResolvedValue({
      id: 'room-existing',
      code: 'Live1234',
      status: 'waiting' as const,
    });

    await expect(service.createRoom(authUser, {})).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(roomsLobbyRepository.createRoom).not.toHaveBeenCalled();
    expect(roomsLobbyRepository.addHumanPlayer).not.toHaveBeenCalled();
  });

  it('creates a waiting room and joins the host in seat one', async () => {
    roomsLobbyRepository.createRoom.mockResolvedValue(waitingRoom);
    roomsLobbyRepository.addHumanPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      playerType: 'human' as const,
      seatNumber: 1,
      status: 'joined' as const,
      joinedAt: createdAt,
      leftAt: null,
    });

    roomsLobbyRepository.listPlayers.mockResolvedValue([
      {
        id: 'player-1',
        roomId: waitingRoom.id,
        userId: authUser.id,
        username: authUser.username,
        playerType: 'human' as const,
        botDifficulty: null,
        botName: null,
        seatNumber: 1,
        status: 'joined' as const,
        joinedAt: createdAt,
        leftAt: null,
      },
    ]);

    const result = await service.createRoom(authUser, { durationMinutes: 60 });

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);

    expect(roomsLobbyRepository.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUserId: authUser.id,
        durationMinutes: 60,
        boardKey: 'classic',
      }),
      tx,
    );

    expect(roomsLobbyRepository.addHumanPlayer).toHaveBeenCalledWith(
      {
        roomId: waitingRoom.id,
        userId: authUser.id,
        seatNumber: 1,
      },
      tx,
    );

    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.created,
      {
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        userId: authUser.id,
        durationMinutes: waitingRoom.durationMinutes,
        boardKey: waitingRoom.boardKey,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.created,
    );

    expect(result).toEqual({
      ...waitingRoom,
      spectatorCount: 0,
      activeGameId: null,
      currentUserAccess: 'player',
      players: [
        {
          id: 'player-1',
          roomId: waitingRoom.id,
          userId: authUser.id,
          username: authUser.username,
          playerType: 'human' as const,
          botDifficulty: null,
          botName: null,
          seatNumber: 1,
          status: 'joined' as const,
          joinedAt: createdAt,
          leftAt: null,
        },
      ],
    });
  });

  it('lists live rooms with spectator counts', async () => {
    const secondRoom = {
      ...activeRoom,
      id: 'room-2',
      code: 'XyZ98AbC',
    };

    roomsLobbyRepository.listLiveRooms.mockResolvedValue([
      activeRoom,
      secondRoom,
    ]);
    roomsLobbyRepository.listPlayersForRooms.mockResolvedValue([
      {
        id: 'player-1',
        roomId: activeRoom.id,
        userId: authUser.id,
        username: authUser.username,
        playerType: 'human' as const,
        botDifficulty: null,
        botName: null,
        seatNumber: 1,
        status: 'joined' as const,
        joinedAt: createdAt,
        leftAt: null,
      },
    ]);
    roomsLobbyRepository.countCurrentSpectatorsForRooms.mockResolvedValue([
      { roomId: activeRoom.id, value: 3 },
    ]);
    roomsLobbyRepository.listActiveGamesForRooms.mockResolvedValue([
      {
        id: 'game-1',
        roomId: activeRoom.id,
        status: 'active',
        expiresAt: new Date('2099-05-14T13:05:00.000Z'),
      },
    ]);

    const result = await service.listLiveRooms(authUser);

    expect(roomsLobbyRepository.listPlayersForRooms).toHaveBeenCalledWith([
      activeRoom.id,
      secondRoom.id,
    ]);
    expect(
      roomsLobbyRepository.countCurrentSpectatorsForRooms,
    ).toHaveBeenCalledWith([activeRoom.id, secondRoom.id]);
    expect(roomsLobbyRepository.listActiveGamesForRooms).toHaveBeenCalledWith([
      activeRoom.id,
      secondRoom.id,
    ]);
    expect(
      roomsLobbyRepository.listCurrentSpectatorsForUserRoomIds,
    ).toHaveBeenCalledWith(authUser.id, [activeRoom.id, secondRoom.id]);
    expect(result).toEqual([
      {
        ...activeRoom,
        spectatorCount: 3,
        activeGameId: 'game-1',
        currentUserAccess: 'player',
        players: [
          expect.objectContaining({
            id: 'player-1',
            roomId: activeRoom.id,
          }),
        ],
      },
      {
        ...secondRoom,
        spectatorCount: 0,
        activeGameId: null,
        currentUserAccess: 'none',
        players: [],
      },
    ]);
  });

  it('joins the first free seat', async () => {
    const joiningUser: AuthUser = {
      ...authUser,
      id: 'user-4',
      email: 'joiner@example.com',
      username: 'joiner',
    };

    roomsLobbyRepository.findRoomByCode.mockResolvedValue(waitingRoom);

    roomsLobbyRepository.listJoinedPlayers.mockResolvedValue([
      { id: 'player-1', userId: 'user-1', seatNumber: 1 },
      { id: 'player-2', userId: 'user-2', seatNumber: 2 },
      { id: 'player-3', userId: 'user-3', seatNumber: 4 },
    ]);

    roomsLobbyRepository.listPlayers.mockResolvedValue([]);

    await service.joinRoom(joiningUser, waitingRoom.code);

    expect(roomsLobbyRepository.addHumanPlayer).toHaveBeenCalledWith({
      roomId: waitingRoom.id,
      userId: joiningUser.id,
      seatNumber: 3,
    });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.joined,
      {
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        userId: joiningUser.id,
        seatNumber: 3,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.joined,
    );
  });

  it('blocks joining a full room', async () => {
    const joiningUser: AuthUser = {
      ...authUser,
      id: 'user-5',
      email: 'joiner@example.com',
      username: 'joiner',
    };

    roomsLobbyRepository.findRoomByCode.mockResolvedValue(waitingRoom);

    roomsLobbyRepository.listJoinedPlayers.mockResolvedValue([
      { id: 'player-1', userId: 'user-1', seatNumber: 1 },
      { id: 'player-2', userId: 'user-2', seatNumber: 2 },
      { id: 'player-3', userId: 'user-3', seatNumber: 3 },
      { id: 'player-4', userId: 'user-4', seatNumber: 4 },
    ]);

    await expect(
      service.joinRoom(joiningUser, waitingRoom.code),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(roomsLobbyRepository.addHumanPlayer).not.toHaveBeenCalled();
  });

  it('cancels a waiting room when the host leaves', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(waitingRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'joined' as const,
    });

    roomsLobbyRepository.leaveRoom.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'left' as const,
    });

    roomsLobbyRepository.cancelRoom.mockResolvedValue({
      ...waitingRoom,
      status: 'cancelled' as const,
      endedAt: new Date('2026-05-14T12:05:00.000Z'),
    });

    const result = await service.leaveRoom(authUser, waitingRoom.code);

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);

    expect(roomsLobbyRepository.leaveRoom).toHaveBeenCalledWith(
      {
        roomId: waitingRoom.id,
        userId: authUser.id,
      },
      tx,
    );

    expect(roomsLobbyRepository.cancelRoom).toHaveBeenCalledWith(
      waitingRoom.id,
      tx,
    );

    expect(result).toEqual({ message: 'Room cancelled' });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.cancelled,
      {
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        userId: authUser.id,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.cancelled,
    );
  });

  it('returns already left when a former room player leaves again', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue(null);
    roomsLobbyRepository.findCurrentSpectator.mockResolvedValue(null);
    roomsLobbyRepository.findPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: activeRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'left' as const,
    });

    const result = await service.leaveRoom(authUser, activeRoom.code);

    expect(result).toEqual({ message: 'Room already left' });
    expect(databaseService.transaction).not.toHaveBeenCalled();
    expect(gameResultsService.finalizeFinishedGame).not.toHaveBeenCalled();
  });

  it('ends spectator session when a former player leaves after spectating', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue(null);
    roomsLobbyRepository.findCurrentSpectator.mockResolvedValue(spectator);
    roomsLobbyRepository.endSpectatorSession.mockResolvedValue({
      ...spectator,
      leftAt: new Date('2026-05-14T12:10:00.000Z'),
    });

    const result = await service.leaveRoom(authUser, activeRoom.code);

    expect(result).toEqual({ message: 'Room left' });
    expect(roomsLobbyRepository.endSpectatorSession).toHaveBeenCalledWith({
      roomId: activeRoom.id,
      userId: authUser.id,
    });
    expect(databaseService.transaction).not.toHaveBeenCalled();
  });

  it('finalizes an active game when the last human player leaves', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: activeRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'joined' as const,
    });
    roomsLobbyRepository.lockRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.leaveRoom.mockResolvedValue({
      id: 'player-1',
      roomId: activeRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'left' as const,
    });
    roomsLobbyRepository.countJoinedHumanPlayers.mockResolvedValue(0);
    roomsLobbyRepository.findActiveGameByRoomId.mockResolvedValue({
      id: 'game-1',
      roomId: activeRoom.id,
      status: 'active' as const,
    });
    gameRecoveryService.getOrRecover.mockResolvedValue(activeGameState);

    const result = await service.leaveRoom(authUser, activeRoom.code);

    expect(result).toEqual({ message: 'Room left' });
    expect(roomsLobbyRepository.lockRoomByCode).toHaveBeenCalledWith(
      activeRoom.code,
      tx,
    );
    expect(roomsLobbyRepository.countJoinedHumanPlayers).toHaveBeenCalledWith(
      activeRoom.id,
      tx,
    );
    expect(gameStateService.set).toHaveBeenCalledWith('game-1', {
      ...activeGameState,
      phase: 'finished',
    });
    expect(gameResultsService.finalizeFinishedGame).toHaveBeenCalledWith({
      gameId: 'game-1',
      state: {
        ...activeGameState,
        phase: 'finished',
      },
      events: [],
    });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.finishedAfterLastHumanLeft,
      {
        roomId: activeRoom.id,
        roomCode: activeRoom.code,
        gameId: 'game-1',
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.finishedAfterLastHumanLeft,
    );
  });

  it('joins active room as spectator', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue(null);
    roomsLobbyRepository.findCurrentSpectator.mockResolvedValue(null);
    roomsLobbyRepository.lockRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.countCurrentSpectators.mockResolvedValue(19);
    roomsLobbyRepository.createSpectator.mockResolvedValue(spectator);

    const result = await service.spectateRoom(authUser, activeRoom.code);

    expect(databaseService.transaction).toHaveBeenCalledTimes(1);
    expect(roomsLobbyRepository.lockRoomByCode).toHaveBeenCalledWith(
      activeRoom.code,
      tx,
    );
    expect(roomsLobbyRepository.countCurrentSpectators).toHaveBeenCalledWith(
      activeRoom.id,
      tx,
    );
    expect(roomsLobbyRepository.createSpectator).toHaveBeenCalledWith(
      {
        roomId: activeRoom.id,
        userId: authUser.id,
      },
      tx,
    );
    expect(result).toEqual({
      message: 'Spectating room',
      spectator,
    });
  });

  it('rejects room player spectating same room', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue({
      id: 'room-player-1',
      roomId: activeRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'joined',
    });

    await expect(
      service.spectateRoom(authUser, activeRoom.code),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
    expect(roomsLobbyRepository.createSpectator).not.toHaveBeenCalled();
  });

  it('rejects spectating when room spectator limit is reached', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue(null);
    roomsLobbyRepository.findCurrentSpectator.mockResolvedValue(null);
    roomsLobbyRepository.lockRoomByCode.mockResolvedValue(activeRoom);
    roomsLobbyRepository.countCurrentSpectators.mockResolvedValue(20);

    await expect(
      service.spectateRoom(authUser, activeRoom.code),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(roomsLobbyRepository.createSpectator).not.toHaveBeenCalled();
  });

  it('invites a friend to a waiting room through notification outbox', async () => {
    const invitee = {
      id: 'user-2',
      email: 'friend@example.com',
      username: 'playertwo',
      avatarObjectKey: 'avatars/user-2/avatar.webp',
    };

    roomsLobbyRepository.findRoomByCode.mockResolvedValue(waitingRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'joined' as const,
    });
    roomsLobbyRepository.findActiveUserByUsername.mockResolvedValue(invitee);
    roomsLobbyRepository.findAcceptedFriendship.mockResolvedValue({
      id: 'friendship-1',
      requesterId: authUser.id,
      addresseeId: invitee.id,
      status: 'accepted' as const,
    });
    roomsLobbyRepository.findActiveRoomForUser.mockResolvedValue(null);
    roomsLobbyRepository.findActiveUserById.mockResolvedValue({
      id: authUser.id,
      email: authUser.email,
      username: authUser.username,
      avatarObjectKey: 'avatars/user-1/avatar.webp',
    });

    notificationsService.createRoomInviteNotification.mockResolvedValue({
      notification: { id: 'notification-1' },
      outboxEventId: 'outbox-1',
    });

    const result = await service.inviteToRoom(authUser, waitingRoom.code, {
      username: ' PlayerTwo ',
    });

    expect(
      notificationsService.createRoomInviteNotification,
    ).toHaveBeenCalledWith(
      {
        userId: invitee.id,
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        inviterId: authUser.id,
        inviterUsername: authUser.username,
        inviterAvatarObjectKey: 'avatars/user-1/avatar.webp',
      },
      tx,
    );

    expect(outboxQueueService.enqueuePublishEvent).toHaveBeenCalledWith(
      'outbox-1',
    );

    expect(result).toEqual({
      message: 'Room invite sent',
      roomCode: waitingRoom.code,
    });
    expect(observabilityService.recordEvent).toHaveBeenCalledWith(
      ROOM_EVENTS.inviteSent,
      {
        roomId: waitingRoom.id,
        roomCode: waitingRoom.code,
        inviterId: authUser.id,
        inviteeId: invitee.id,
      },
    );
    expect(observabilityService.recordMetric).toHaveBeenCalledWith(
      ROOM_METRICS.inviteSent,
    );
  });

  it('blocks inviting users who are not accepted friends', async () => {
    roomsLobbyRepository.findRoomByCode.mockResolvedValue(waitingRoom);
    roomsLobbyRepository.findJoinedPlayer.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'joined' as const,
    });
    roomsLobbyRepository.findActiveUserByUsername.mockResolvedValue({
      id: 'user-2',
      email: 'friend@example.com',
      username: 'playertwo',
      avatarObjectKey: null,
    });
    roomsLobbyRepository.findAcceptedFriendship.mockResolvedValue(null);

    await expect(
      service.inviteToRoom(authUser, waitingRoom.code, {
        username: 'playertwo',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      notificationsService.createRoomInviteNotification,
    ).not.toHaveBeenCalled();
    expect(outboxQueueService.enqueuePublishEvent).not.toHaveBeenCalled();
  });
});

import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
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
  listJoinedPlayers: jest.Mock;
  findJoinedPlayer: jest.Mock;
  leaveRoom: jest.Mock;
  cancelRoom: jest.Mock;
  findActiveUserByUsername: jest.Mock;
  findActiveUserById: jest.Mock;
  findAcceptedFriendship: jest.Mock;
  isRoomCodeUniqueViolation: jest.Mock;
  isSeatUniqueViolation: jest.Mock;
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

describe('RoomsLobbyService', () => {
  let service: RoomsLobbyService;
  let roomsLobbyRepository: RoomsLobbyRepositoryMock;
  let databaseService: DatabaseServiceMock;
  let notificationsService: NotificationsServiceMock;
  let outboxQueueService: OutboxQueueServiceMock;
  let observabilityService: ObservabilityServiceMock;

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
      listJoinedPlayers: jest.fn(),
      findJoinedPlayer: jest.fn(),
      leaveRoom: jest.fn(),
      cancelRoom: jest.fn(),
      findActiveUserByUsername: jest.fn(),
      findActiveUserById: jest.fn(),
      findAcceptedFriendship: jest.fn(),
      isRoomCodeUniqueViolation: jest.fn().mockReturnValue(false),
      isSeatUniqueViolation: jest.fn().mockReturnValue(false),
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

    service = new RoomsLobbyService(
      roomsLobbyRepository as unknown as RoomsLobbyRepository,
      databaseService as unknown as DatabaseService,
      notificationsService as unknown as NotificationsService,
      outboxQueueService as unknown as OutboxQueueService,
      observabilityService as unknown as ObservabilityService,
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

import { ConflictException } from '@nestjs/common';
import type { AuthUser } from '../../auth/types/auth-user.type';
import type { DatabaseService } from '../../infra/database/database.service';
import type { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import { RoomsLobbyService } from '../services/rooms-lobby.service';

type RoomsLobbyRepositoryMock = {
  findActiveRoomForUser: jest.Mock;
  createRoom: jest.Mock;
  addHumanPlayer: jest.Mock;
  findRoomByCode: jest.Mock;
  listLiveRooms: jest.Mock;
  listPlayers: jest.Mock;
  listJoinedPlayers: jest.Mock;
  findJoinedPlayer: jest.Mock;
  leaveRoom: jest.Mock;
  cancelRoom: jest.Mock;
  isRoomCodeUniqueViolation: jest.Mock;
  isSeatUniqueViolation: jest.Mock;
};

type DatabaseServiceMock = {
  transaction: jest.Mock;
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
  status: 'waiting',
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

  const tx = { tx: true };

  beforeEach(() => {
    roomsLobbyRepository = {
      findActiveRoomForUser: jest.fn().mockResolvedValue(null),
      createRoom: jest.fn(),
      addHumanPlayer: jest.fn(),
      findRoomByCode: jest.fn(),
      listLiveRooms: jest.fn(),
      listPlayers: jest.fn().mockResolvedValue([]),
      listJoinedPlayers: jest.fn(),
      findJoinedPlayer: jest.fn(),
      leaveRoom: jest.fn(),
      cancelRoom: jest.fn(),
      isRoomCodeUniqueViolation: jest.fn().mockReturnValue(false),
      isSeatUniqueViolation: jest.fn().mockReturnValue(false),
    };

    databaseService = {
      transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
    };

    service = new RoomsLobbyService(
      roomsLobbyRepository as unknown as RoomsLobbyRepository,
      databaseService as unknown as DatabaseService,
    );
  });

  it('rejects creating a room when the user is already in a waiting or active room', async () => {
    roomsLobbyRepository.findActiveRoomForUser.mockResolvedValue({
      id: 'room-existing',
      code: 'Live1234',
      status: 'waiting',
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
      playerType: 'human',
      seatNumber: 1,
      status: 'joined',
      joinedAt: createdAt,
      leftAt: null,
    });

    roomsLobbyRepository.listPlayers.mockResolvedValue([
      {
        id: 'player-1',
        roomId: waitingRoom.id,
        userId: authUser.id,
        username: authUser.username,
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 1,
        status: 'joined',
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

    expect(result).toEqual({
      ...waitingRoom,
      players: [
        {
          id: 'player-1',
          roomId: waitingRoom.id,
          userId: authUser.id,
          username: authUser.username,
          playerType: 'human',
          botDifficulty: null,
          botName: null,
          seatNumber: 1,
          status: 'joined',
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

    roomsLobbyRepository.listPlayers.mockResolvedValue([
      {
        id: 'player-1',
        roomId: waitingRoom.id,
        userId: 'user-1',
        username: 'playerone',
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 1,
        status: 'joined',
        joinedAt: createdAt,
        leftAt: null,
      },
      {
        id: 'player-2',
        roomId: waitingRoom.id,
        userId: 'user-2',
        username: 'playertwo',
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 2,
        status: 'joined',
        joinedAt: createdAt,
        leftAt: null,
      },
      {
        id: 'player-4',
        roomId: waitingRoom.id,
        userId: joiningUser.id,
        username: joiningUser.username,
        playerType: 'human',
        botDifficulty: null,
        botName: null,
        seatNumber: 3,
        status: 'joined',
        joinedAt: createdAt,
        leftAt: null,
      },
    ]);

    await service.joinRoom(joiningUser, waitingRoom.code);

    expect(roomsLobbyRepository.addHumanPlayer).toHaveBeenCalledWith({
      roomId: waitingRoom.id,
      userId: joiningUser.id,
      seatNumber: 3,
    });
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
      status: 'joined',
    });

    roomsLobbyRepository.leaveRoom.mockResolvedValue({
      id: 'player-1',
      roomId: waitingRoom.id,
      userId: authUser.id,
      seatNumber: 1,
      status: 'left',
    });

    roomsLobbyRepository.cancelRoom.mockResolvedValue({
      ...waitingRoom,
      status: 'cancelled',
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
  });
});

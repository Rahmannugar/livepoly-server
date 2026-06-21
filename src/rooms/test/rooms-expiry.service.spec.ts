import { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import { RoomsExpiryService } from '../services/rooms-expiry.service';
import { RoomsStreamService } from '../services/rooms-stream.service';
import { WAITING_ROOM_EXPIRY_MS } from '../rooms.constants';

describe('RoomsExpiryService', () => {
  const roomsLobbyRepository = {
    expireWaitingRooms: jest.fn(),
  };
  const roomsStreamService = {
    publishRoomChanged: jest.fn(),
  };
  const observabilityService = {
    recordEvent: jest.fn(),
    recordMetric: jest.fn(),
  };

  let service: RoomsExpiryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoomsExpiryService(
      roomsLobbyRepository as unknown as RoomsLobbyRepository,
      roomsStreamService as unknown as RoomsStreamService,
      observabilityService,
    );
  });

  it('expires waiting rooms older than the expiry window', async () => {
    const now = new Date('2026-06-21T12:00:00.000Z');
    const room = {
      id: 'room-1',
      code: 'abc12345',
      hostUserId: 'user-1',
    };

    roomsLobbyRepository.expireWaitingRooms.mockResolvedValue([room]);

    const result = await service.expireWaitingRooms(now);

    expect(roomsLobbyRepository.expireWaitingRooms).toHaveBeenCalledWith(
      new Date(now.getTime() - WAITING_ROOM_EXPIRY_MS),
    );
    expect(roomsStreamService.publishRoomChanged).toHaveBeenCalledWith({
      roomId: room.id,
      roomCode: room.code,
      event: 'room.cancelled',
    });
    expect(result).toEqual({
      expiredCount: 1,
      expiredRoomCodes: [room.code],
    });
  });
});

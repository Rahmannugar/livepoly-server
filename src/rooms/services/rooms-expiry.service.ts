import { Injectable, Logger } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { RoomsLobbyRepository } from '../repositories/rooms-lobby.repository';
import {
  ROOM_EVENTS,
  ROOM_METRICS,
  WAITING_ROOM_EXPIRY_MS,
} from '../rooms.constants';
import { RoomsStreamService } from './rooms-stream.service';

@Injectable()
export class RoomsExpiryService {
  private readonly logger = new Logger(RoomsExpiryService.name);

  constructor(
    private readonly roomsLobbyRepository: RoomsLobbyRepository,
    private readonly roomsStreamService: RoomsStreamService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async expireWaitingRooms(now = new Date()) {
    const cutoff = new Date(now.getTime() - WAITING_ROOM_EXPIRY_MS);
    const expiredRooms =
      await this.roomsLobbyRepository.expireWaitingRooms(cutoff);

    for (const room of expiredRooms) {
      this.observabilityService.recordEvent(ROOM_EVENTS.waitingExpired, {
        roomId: room.id,
        roomCode: room.code,
        hostUserId: room.hostUserId,
      });
      this.observabilityService.recordMetric(ROOM_METRICS.waitingExpired);
      await this.roomsStreamService.publishRoomChanged({
        roomId: room.id,
        roomCode: room.code,
        event: 'room.cancelled',
      });
    }

    if (expiredRooms.length > 0) {
      this.logger.log({
        message: 'rooms.expiry.waiting_rooms_expired',
        expiredCount: expiredRooms.length,
        cutoff: cutoff.toISOString(),
      });
    }

    return {
      expiredCount: expiredRooms.length,
      expiredRoomCodes: expiredRooms.map((room) => room.code),
    };
  }
}

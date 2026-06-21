import type { Queue } from 'bullmq';
import type { ObservabilityService } from '../../infra/observability/observability.service';
import { ROOM_JOBS } from '../../infra/queue/queue.constants';
import { RoomsQueueService } from '../jobs/rooms-queue.service';

describe('RoomsQueueService', () => {
  const roomsQueue = {
    add: jest.fn(),
  };
  const observabilityService = {
    recordEvent: jest.fn(),
    recordMetric: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schedules expiry for the room deadline', async () => {
    const service = new RoomsQueueService(
      roomsQueue as unknown as Queue,
      observabilityService as unknown as ObservabilityService,
    );

    await service.enqueueWaitingRoomExpiry('room-1', 61_000);

    expect(roomsQueue.add).toHaveBeenCalledWith(
      ROOM_JOBS.expireWaitingRoom,
      { roomId: 'room-1', expiresAt: 61_000 },
      expect.objectContaining({
        jobId: 'waiting-room-expiry__room-1',
        delay: 60_000,
        attempts: 3,
      }),
    );
  });
});

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, ROOM_JOBS } from '../../infra/queue/queue.constants';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';
import {
  WAITING_ROOM_EXPIRY_REPEAT_JOB_ID,
  WAITING_ROOM_EXPIRY_SWEEP_EVERY_MS,
} from '../rooms.constants';

@Injectable()
export class RoomsQueueService {
  constructor(@InjectQueue(QUEUES.rooms) private readonly roomsQueue: Queue) {}

  async enqueueScheduledWaitingRoomExpiry(): Promise<void> {
    await this.roomsQueue.add(
      ROOM_JOBS.expireWaitingRooms,
      {},
      {
        jobId: WAITING_ROOM_EXPIRY_REPEAT_JOB_ID,
        repeat: { every: WAITING_ROOM_EXPIRY_SWEEP_EVERY_MS },
        attempts: 3,
        backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: 100,
      },
    );
  }
}

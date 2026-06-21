import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES, ROOM_JOBS } from '../../infra/queue/queue.constants';
import { exponentialBackoffWithJitter } from '../../infra/queue/queue-jitter';
import {
  ROOM_EVENTS,
  ROOM_METRICS,
  WAITING_ROOM_EXPIRY_REPEAT_JOB_ID,
  WAITING_ROOM_EXPIRY_SWEEP_EVERY_MS,
} from '../rooms.constants';
import { ObservabilityService } from '../../infra/observability/observability.service';
import type { ExpireWaitingRoomJob } from './rooms-job.types';

@Injectable()
export class RoomsQueueService {
  constructor(
    @InjectQueue(QUEUES.rooms) private readonly roomsQueue: Queue,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async enqueueWaitingRoomExpiry(
    roomId: string,
    expiresAt: number,
  ): Promise<void> {
    const data: ExpireWaitingRoomJob = { roomId, expiresAt };
    const delay = Math.max(expiresAt - Date.now(), 0);

    await this.roomsQueue.add(ROOM_JOBS.expireWaitingRoom, data, {
      jobId: ['waiting-room-expiry', roomId].join('__'),
      delay,
      attempts: 3,
      backoff: exponentialBackoffWithJitter({ delay: 1_000 }),
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
      removeOnFail: 100,
    });

    this.observabilityService.recordEvent(ROOM_EVENTS.waitingExpiryQueued, {
      ...data,
      delay,
    });
    this.observabilityService.recordMetric(ROOM_METRICS.waitingExpiryQueued);
  }

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

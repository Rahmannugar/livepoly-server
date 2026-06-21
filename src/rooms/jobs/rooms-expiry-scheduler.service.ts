import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { CacheService } from '../../infra/cache/cache.service';
import { RoomsQueueService } from './rooms-queue.service';

const ROOMS_EXPIRY_SCHEDULER_LOCK_KEY = 'worker:singleton:rooms-expiry';
const ROOMS_EXPIRY_SCHEDULER_LOCK_TTL_SECONDS = 60;

@Injectable()
export class RoomsExpiryScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly roomsQueueService: RoomsQueueService,
    private readonly cacheService: CacheService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.cacheService.withLockOrSkip({
      key: ROOMS_EXPIRY_SCHEDULER_LOCK_KEY,
      ttlSeconds: ROOMS_EXPIRY_SCHEDULER_LOCK_TTL_SECONDS,
      callback: () =>
        this.roomsQueueService.enqueueScheduledWaitingRoomExpiry(),
    });
  }
}

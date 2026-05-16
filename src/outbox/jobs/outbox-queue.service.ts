import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OUTBOX_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import type { PublishOutboxEventJob } from './outbox-jobs.types';

@Injectable()
export class OutboxQueueService {
  constructor(
    @InjectQueue(QUEUES.outbox) private readonly outboxQueue: Queue,
  ) {}

  async enqueuePublishEvent(outboxEventId: string) {
    const payload: PublishOutboxEventJob = { outboxEventId };

    await this.outboxQueue.add(OUTBOX_JOBS.publishEvent, payload, {
      jobId: `outbox:publish:${outboxEventId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { OUTBOX_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { OutboxPublisher } from '../outbox.publisher';
import type { OutboxJob } from './outbox-jobs.types';

@Processor(QUEUES.outbox)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(private readonly outboxPublisher: OutboxPublisher) {
    super();
  }

  async process(job: Job<OutboxJob>) {
    this.logger.log({
      message: 'Outbox job started',
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
    });

    if (job.name === OUTBOX_JOBS.publishEvent) {
      if (!('outboxEventId' in job.data)) {
        throw new Error('Invalid outbox publish job payload');
      }

      await this.outboxPublisher.publishById(job.data.outboxEventId);

      this.logger.log({
        message: 'Outbox job completed',
        jobId: job.id,
        outboxEventId: job.data.outboxEventId,
      });

      return;
    }

    this.logger.warn({
      message: 'Unknown outbox job received',
      jobId: job.id,
      jobName: job.name,
    });
  }
}

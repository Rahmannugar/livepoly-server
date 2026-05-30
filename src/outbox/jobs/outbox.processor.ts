import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { OUTBOX_JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { OUTBOX_EVENTS, OUTBOX_METRICS } from '../outbox.constants';
import { OutboxPublisher } from '../outbox.publisher';
import type { OutboxJob } from './outbox-jobs.types';

@Processor(QUEUES.outbox)
export class OutboxProcessor extends WorkerHost {
  constructor(
    private readonly outboxPublisher: OutboxPublisher,
    private readonly observabilityService: ObservabilityService,
  ) {
    super();
  }

  async process(job: Job<OutboxJob>) {
    if (job.name === OUTBOX_JOBS.publishEvent) {
      if (!('outboxEventId' in job.data)) {
        throw new Error('Invalid outbox publish job payload');
      }

      await this.outboxPublisher.publishById(job.data.outboxEventId);

      this.observabilityService.recordEvent(OUTBOX_EVENTS.jobCompleted, {
        jobId: job.id,
        jobName: job.name,
        outboxEventId: job.data.outboxEventId,
      });
      this.observabilityService.recordMetric(OUTBOX_METRICS.jobCompleted);

      return;
    }

    this.observabilityService.recordEvent(OUTBOX_EVENTS.unknownJobReceived, {
      jobId: job.id,
      jobName: job.name,
    });
    this.observabilityService.recordMetric(OUTBOX_METRICS.unknownJobReceived);
  }
}

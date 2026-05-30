import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ObservabilityService } from '../../infra/observability/observability.service';
import { OUTBOX_EVENTS, OUTBOX_METRICS } from '../outbox.constants';
import { OutboxService } from '../outbox.service';
import { OutboxQueueService } from './outbox-queue.service';

const OUTBOX_RECOVERY_BATCH_SIZE = 100;

@Injectable()
export class OutboxRecoveryService implements OnApplicationBootstrap {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly outboxQueueService: OutboxQueueService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const candidates = await this.outboxService.findAvailable(
        OUTBOX_RECOVERY_BATCH_SIZE,
      );

      for (const candidate of candidates) {
        await this.outboxQueueService.enqueuePublishEvent(candidate.id);
      }

      this.observabilityService.recordEvent(OUTBOX_EVENTS.recoveryCompleted, {
        recoveredCount: candidates.length,
      });
      this.observabilityService.recordMetric(OUTBOX_METRICS.recoveryCompleted);
    } catch (error) {
      this.observabilityService.recordEvent(OUTBOX_EVENTS.recoveryFailed, {
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      this.observabilityService.recordMetric(OUTBOX_METRICS.recoveryFailed);
    }
  }
}

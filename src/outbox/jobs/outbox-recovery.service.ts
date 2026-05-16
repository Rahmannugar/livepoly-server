import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OutboxService } from '../outbox.service';
import { OutboxQueueService } from './outbox-queue.service';

const OUTBOX_RECOVERY_BATCH_SIZE = 100;

@Injectable()
export class OutboxRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxRecoveryService.name);

  constructor(
    private readonly outboxService: OutboxService,
    private readonly outboxQueueService: OutboxQueueService,
  ) {}

  async onApplicationBootstrap() {
    const candidates = await this.outboxService.findAvailable(
      OUTBOX_RECOVERY_BATCH_SIZE,
    );

    for (const candidate of candidates) {
      await this.outboxQueueService.enqueuePublishEvent(candidate.id);
    }

    this.logger.log({
      message: 'Outbox recovery completed',
      recoveredCount: candidates.length,
    });
  }
}

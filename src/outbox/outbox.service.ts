import { Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../infra/database/database.service';
import type { CreateOutboxEventInput, OutboxEvent } from './outbox.types';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class OutboxService {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  createOrGet(input: CreateOutboxEventInput, executor?: DatabaseExecutor) {
    return this.outboxRepository.createOrGet(input, executor);
  }

  findAvailable(limit: number) {
    return this.outboxRepository.findAvailable(limit);
  }

  claimById(eventId: string): Promise<OutboxEvent | null> {
    return this.outboxRepository.start(eventId);
  }

  markPublished(eventId: string) {
    return this.outboxRepository.markPublished(eventId);
  }

  fail(eventId: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown outbox publish error';

    return this.outboxRepository.markFailed(eventId, message.slice(0, 2000));
  }
}

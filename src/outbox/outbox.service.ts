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

  claimById(eventId: string): Promise<OutboxEvent | null> {
    return this.outboxRepository.start(eventId);
  }

  async claimAvailable(limit: number): Promise<OutboxEvent[]> {
    const candidates = await this.outboxRepository.findAvailable(limit);
    const events: OutboxEvent[] = [];

    for (const candidate of candidates) {
      const event = await this.outboxRepository.start(candidate.id);

      if (event) {
        events.push(event);
      }
    }

    return events;
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

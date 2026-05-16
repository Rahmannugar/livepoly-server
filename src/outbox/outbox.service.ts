import { Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../infra/database/database.service';
import type { CreateOutboxEventInput } from './outbox.types';
import { OutboxRepository } from './outbox.repository';

@Injectable()
export class OutboxService {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  createOrGet(input: CreateOutboxEventInput, executor?: DatabaseExecutor) {
    return this.outboxRepository.createOrGet(input, executor);
  }
}

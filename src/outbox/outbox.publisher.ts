import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { PubSubService } from '../infra/pubsub/pubsub.service';
import { OUTBOX_TOPICS, type OutboxEvent } from './outbox.types';
import { OutboxService } from './outbox.service';

const notificationCreatedPayloadSchema = z.object({
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().min(1),
});

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);

  constructor(
    private readonly outboxService: OutboxService,
    private readonly pubSubService: PubSubService,
  ) {}

  async publishById(eventId: string) {
    const event = await this.outboxService.claimById(eventId);

    if (!event) {
      this.logger.log({
        message: 'Outbox event publish skipped',
        eventId,
        reason: 'not_claimable',
      });

      return;
    }

    await this.publishEvent(event);
  }

  async publishAvailable(limit: number) {
    const events = await this.outboxService.claimAvailable(limit);

    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  private async publishEvent(event: OutboxEvent) {
    try {
      if (event.topic === OUTBOX_TOPICS.notificationCreated) {
        await this.publishNotificationCreated(event);
        await this.outboxService.markPublished(event.id);
        return;
      }

      throw new Error(`Unknown outbox topic: ${event.topic}`);
    } catch (error) {
      await this.outboxService.fail(event.id, error);

      this.logger.error({
        message: 'Outbox event publish failed',
        eventId: event.id,
        eventKey: event.key,
        topic: event.topic,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async publishNotificationCreated(event: OutboxEvent) {
    const payload = notificationCreatedPayloadSchema.parse(event.payload);

    await this.pubSubService.publish(`user:${payload.userId}:notifications`, {
      event: OUTBOX_TOPICS.notificationCreated,
      data: payload,
    });

    this.logger.log({
      message: 'Outbox notification event published',
      eventId: event.id,
      notificationId: payload.notificationId,
      userId: payload.userId,
    });
  }
}

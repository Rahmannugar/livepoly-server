import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ObservabilityService } from '../infra/observability/observability.service';
import { PubSubService } from '../infra/pubsub/pubsub.service';
import { OUTBOX_EVENTS, OUTBOX_METRICS } from './outbox.constants';
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
  constructor(
    private readonly outboxService: OutboxService,
    private readonly pubSubService: PubSubService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  async publishById(eventId: string) {
    const event = await this.outboxService.claimById(eventId);

    if (!event) {
      this.observabilityService.recordEvent(OUTBOX_EVENTS.eventPublishSkipped, {
        eventId,
        reason: 'not_claimable',
      });
      this.observabilityService.recordMetric(
        OUTBOX_METRICS.eventPublishSkipped,
      );

      return;
    }

    await this.publishEvent(event);
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

      this.observabilityService.recordEvent(OUTBOX_EVENTS.eventPublishFailed, {
        eventId: event.id,
        eventKey: event.key,
        topic: event.topic,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : undefined,
      });
      this.observabilityService.recordMetric(OUTBOX_METRICS.eventPublishFailed);

      throw error;
    }
  }

  private async publishNotificationCreated(event: OutboxEvent) {
    const payload = notificationCreatedPayloadSchema.parse(event.payload);

    await this.pubSubService.publish(`user:${payload.userId}:notifications`, {
      event: OUTBOX_TOPICS.notificationCreated,
      data: payload,
    });

    this.observabilityService.recordEvent(OUTBOX_EVENTS.eventPublished, {
      eventId: event.id,
      topic: event.topic,
      notificationId: payload.notificationId,
      userId: payload.userId,
    });
    this.observabilityService.recordMetric(OUTBOX_METRICS.eventPublished);
  }
}

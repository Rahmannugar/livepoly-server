import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { z } from 'zod';
import { PubSubService } from '../infra/pubsub/pubsub.service';
import { OUTBOX_TOPICS, type OutboxEvent } from './outbox.types';
import { OutboxService } from './outbox.service';

const OUTBOX_BATCH_SIZE = 25;
const OUTBOX_POLL_INTERVAL_MS = 1000;

const notificationCreatedPayloadSchema = z.object({
  notificationId: z.string().min(1),
  userId: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().min(1),
});

@Injectable()
export class OutboxPublisher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly pubSubService: PubSubService,
  ) {}

  onApplicationBootstrap() {
    void this.publishPending();

    this.timer = setInterval(() => {
      void this.publishPending();
    }, OUTBOX_POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async publishPending() {
    if (this.publishing) {
      return;
    }

    this.publishing = true;

    try {
      const events = await this.outboxService.claimPending(OUTBOX_BATCH_SIZE);

      for (const event of events) {
        await this.publishEvent(event);
      }
    } finally {
      this.publishing = false;
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

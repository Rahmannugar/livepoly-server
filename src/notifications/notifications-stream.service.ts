import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  prepareSseResponse,
  SSE_HEARTBEAT_MS,
  writeSseComment,
  writeSseEvent,
} from '../common/sse/sse-stream';
import { PubSubService } from '../infra/pubsub/pubsub.service';
import { ObservabilityService } from '../infra/observability/observability.service';

@Injectable()
export class NotificationsStreamService {
  private readonly logger = new Logger(NotificationsStreamService.name);

  constructor(
    private readonly pubSubService: PubSubService,
    private readonly observabilityService: ObservabilityService,
  ) {}

  streamForUser(userId: string, response: Response): void {
    const setupStartedAt = Date.now();
    const channel = `user:${userId}:notifications`;
    let setupFinished = false;

    const finishSetup = (outcome: 'Connected' | 'Closed' | 'Failed') => {
      if (setupFinished) {
        return;
      }

      setupFinished = true;
      this.observabilityService.recordMetric(
        `Custom/Realtime/SSE/Notifications/Setup${outcome}`,
      );
      this.observabilityService.recordDurationMetric(
        'Custom/Realtime/SSE/Notifications/SetupDuration',
        Date.now() - setupStartedAt,
      );
      this.observabilityService.endCurrentTransaction();
    };

    this.observabilityService.nameCurrentTransaction(
      'Realtime/SSE/Notifications/Connect',
      { transport: 'sse', stream: 'notifications', userId },
    );

    prepareSseResponse(response);

    let closed = false;
    let unsubscribe: (() => Promise<void>) | null = null;

    const close = () => {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(heartbeat);

      if (unsubscribe) {
        void unsubscribe();
      }

      this.observabilityService.recordMetric(
        'Custom/Realtime/SSE/Notifications/Disconnected',
      );
      finishSetup('Closed');
    };

    const heartbeat = setInterval(() => {
      writeSseComment(response, 'ping');
    }, SSE_HEARTBEAT_MS);

    writeSseComment(response, 'connected');

    response.on('close', close);
    response.on('error', close);

    void this.pubSubService
      .subscribe(channel, (payload) => {
        if (closed) {
          return;
        }

        const event =
          typeof payload.event === 'string' ? payload.event : 'message';

        writeSseEvent(response, event, payload.data ?? payload);
      })
      .then((subscription) => {
        if (closed) {
          void subscription.unsubscribe();
          finishSetup('Closed');
          return;
        }

        unsubscribe = () => subscription.unsubscribe();
        finishSetup('Connected');
      })
      .catch((error) => {
        this.logger.warn({
          message: 'notification_stream.subscribe_failed',
          userId,
          errorName: error instanceof Error ? error.name : undefined,
        });
        finishSetup('Failed');
        response.end();
      });
  }
}

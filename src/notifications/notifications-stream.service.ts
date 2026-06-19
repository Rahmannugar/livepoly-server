import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  prepareSseResponse,
  SSE_HEARTBEAT_MS,
  writeSseComment,
  writeSseEvent,
} from '../common/sse/sse-stream';
import { PubSubService } from '../infra/pubsub/pubsub.service';

@Injectable()
export class NotificationsStreamService {
  private readonly logger = new Logger(NotificationsStreamService.name);

  constructor(private readonly pubSubService: PubSubService) {}

  streamForUser(userId: string, response: Response): void {
    const channel = `user:${userId}:notifications`;

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
          return;
        }

        unsubscribe = () => subscription.unsubscribe();
      })
      .catch((error) => {
        this.logger.warn({
          message: 'notification_stream.subscribe_failed',
          userId,
          errorName: error instanceof Error ? error.name : undefined,
        });
        response.end();
      });
  }
}

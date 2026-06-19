import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PubSubService } from '../../infra/pubsub/pubsub.service';
import type { PubSubPayload } from '../../infra/pubsub/pubsub.types';

type RoomStreamEvent =
  | 'room.created'
  | 'room.joined'
  | 'room.left'
  | 'room.cancelled'
  | 'room.spectator_joined'
  | 'room.spectator_left'
  | 'room.started';

const ROOM_STREAM_HEARTBEAT_MS = 25_000;

@Injectable()
export class RoomsStreamService {
  private readonly logger = new Logger(RoomsStreamService.name);

  constructor(private readonly pubSubService: PubSubService) {}

  streamRoom(code: string, response: Response): void {
    const channel = this.getRoomChannel(code);

    response.status(200);
    response.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control':
        'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
      Connection: 'keep-alive',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders?.();

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
      this.writeSseComment(response, 'ping');
    }, ROOM_STREAM_HEARTBEAT_MS);

    this.writeSseComment(response, 'connected');

    response.on('close', close);
    response.on('error', close);

    void this.pubSubService
      .subscribe(channel, (payload) => {
        if (closed) {
          return;
        }

        this.writeSseEvent(response, 'room.updated', payload);
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
          message: 'room_stream.subscribe_failed',
          roomCode: code,
          errorName: error instanceof Error ? error.name : undefined,
        });
        response.end();
      });
  }

  async publishRoomChanged(input: {
    roomId: string;
    roomCode: string;
    event: RoomStreamEvent;
  }): Promise<void> {
    try {
      await this.pubSubService.publish(this.getRoomChannel(input.roomCode), {
        event: input.event,
        data: {
          roomId: input.roomId,
          roomCode: input.roomCode,
          changedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn({
        message: 'room_stream.publish_failed',
        roomId: input.roomId,
        roomCode: input.roomCode,
        event: input.event,
        errorName: error instanceof Error ? error.name : undefined,
      });
    }
  }

  private getRoomChannel(code: string): string {
    return `room:${code}:updates`;
  }

  private writeSseComment(response: Response, comment: string): void {
    if (response.writableEnded) {
      return;
    }

    response.write(`: ${comment}\n\n`);
  }

  private writeSseEvent(
    response: Response,
    event: string,
    payload: PubSubPayload,
  ): void {
    if (response.writableEnded) {
      return;
    }

    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  prepareSseResponse,
  SSE_HEARTBEAT_MS,
  writeSseComment,
  writeSseEvent,
} from '../../common/sse/sse-stream';
import { PubSubService } from '../../infra/pubsub/pubsub.service';

type RoomStreamEvent =
  | 'room.created'
  | 'room.joined'
  | 'room.left'
  | 'room.cancelled'
  | 'room.spectator_joined'
  | 'room.spectator_left'
  | 'room.started';

@Injectable()
export class RoomsStreamService {
  private readonly logger = new Logger(RoomsStreamService.name);

  constructor(private readonly pubSubService: PubSubService) {}

  streamRoom(code: string, response: Response): void {
    const channel = this.getRoomChannel(code);

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

        writeSseEvent(response, 'room.updated', payload);
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
}

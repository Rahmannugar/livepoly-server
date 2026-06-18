import { Injectable, Logger } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
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

  streamRoom(code: string): Observable<MessageEvent> {
    const channel = this.getRoomChannel(code);

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let unsubscribe: (() => Promise<void>) | null = null;

      void this.pubSubService
        .subscribe(channel, (payload) => {
          if (closed) {
            return;
          }

          subscriber.next({
            type: 'room.updated',
            data: payload,
          });
        })
        .then((subscription) => {
          unsubscribe = () => subscription.unsubscribe();
        })
        .catch((error) => {
          subscriber.error(error);
        });

      return () => {
        closed = true;

        if (unsubscribe) {
          void unsubscribe();
        }
      };
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

import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PubSubService } from '../infra/pubsub/pubsub.service';

@Injectable()
export class NotificationsStreamService {
  constructor(private readonly pubSubService: PubSubService) {}

  streamForUser(userId: string): Observable<MessageEvent> {
    const channel = `user:${userId}:notifications`;

    return new Observable<MessageEvent>((subscriber) => {
      let closed = false;
      let unsubscribe: (() => Promise<void>) | null = null;

      void this.pubSubService
        .subscribe(channel, (payload) => {
          if (closed) {
            return;
          }

          const event =
            typeof payload.event === 'string' ? payload.event : 'message';

          subscriber.next({
            type: event,
            data: payload.data ?? payload,
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
}

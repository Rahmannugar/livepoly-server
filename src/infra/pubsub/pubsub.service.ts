import { Injectable } from '@nestjs/common';
import { RedisPubSubClient } from './redis-pubsub.client';
import type { PubSubMessageHandler, PubSubPayload } from './pubsub.types';

@Injectable()
export class PubSubService {
  constructor(private readonly pubSubClient: RedisPubSubClient) {}

  publish(channel: string, payload: PubSubPayload) {
    return this.pubSubClient.publish(channel, payload);
  }

  subscribe(channel: string, handler: PubSubMessageHandler) {
    return this.pubSubClient.subscribe(channel, handler);
  }
}

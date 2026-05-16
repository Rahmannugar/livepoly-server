import { Injectable } from '@nestjs/common';
import { RedisPubSubClient } from './redis-pubsub.client';
import type { PubSubPayload } from './pubsub.types';

@Injectable()
export class PubSubService {
  constructor(private readonly pubSubClient: RedisPubSubClient) {}

  publish(channel: string, payload: PubSubPayload) {
    return this.pubSubClient.publish(channel, payload);
  }
}

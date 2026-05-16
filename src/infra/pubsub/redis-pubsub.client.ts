import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type {
  PubSubClient,
  PubSubMessageHandler,
  PubSubPayload,
  PubSubSubscription,
} from './pubsub.types';

@Injectable()
export class RedisPubSubClient implements PubSubClient, OnModuleDestroy {
  private readonly publisher: Redis;
  private readonly subscribers = new Set<Redis>();

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async publish(channel: string, payload: PubSubPayload): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(
    channel: string,
    handler: PubSubMessageHandler,
  ): Promise<PubSubSubscription> {
    const subscriber = this.publisher.duplicate();

    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel !== channel) {
        return;
      }

      try {
        handler(JSON.parse(message) as PubSubPayload);
      } catch {
        // Ignore malformed internal pub/sub payloads.
      }
    });

    await subscriber.subscribe(channel);
    this.subscribers.add(subscriber);

    return {
      unsubscribe: async () => {
        await subscriber.unsubscribe(channel);
        this.subscribers.delete(subscriber);
        await subscriber.quit();
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.subscribers).map(async (subscriber) => {
        await subscriber.quit();
      }),
    );

    await this.publisher.quit();
  }
}

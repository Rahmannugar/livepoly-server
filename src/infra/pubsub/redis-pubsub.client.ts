import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { PubSubClient, PubSubPayload } from './pubsub.types';

@Injectable()
export class RedisPubSubClient implements PubSubClient, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async publish(channel: string, payload: PubSubPayload): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

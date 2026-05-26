import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Emitter } from '@socket.io/redis-emitter';
import Redis from 'ioredis';

@Injectable()
export class RealtimeEmitterService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly emitter: Emitter;

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    this.emitter = new Emitter(this.redis);
  }

  emitToRoom(
    namespace: string,
    room: string,
    event: string,
    payload: unknown,
  ): void {
    this.emitter.of(namespace).to(room).emit(event, payload);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

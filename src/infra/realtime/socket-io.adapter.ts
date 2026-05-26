import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

export class SocketIoAdapter extends IoAdapter {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(app: INestApplication, configService: ConfigService) {
    super(app);

    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    this.subscriber = this.publisher.duplicate();
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;

    server.adapter(createAdapter(this.publisher, this.subscriber));

    return server;
  }

  async close(server: Server): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    await super.close(server);
  }
}

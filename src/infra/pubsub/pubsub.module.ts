import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PubSubService } from './pubsub.service';
import { RedisPubSubClient } from './redis-pubsub.client';

@Module({
  imports: [ConfigModule],
  providers: [PubSubService, RedisPubSubClient],
  exports: [PubSubService],
})
export class PubSubModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RealtimeEmitterService } from './realtime-emitter.service';

@Module({
  imports: [ConfigModule],
  providers: [RealtimeEmitterService],
  exports: [RealtimeEmitterService],
})
export class RealtimeModule {}

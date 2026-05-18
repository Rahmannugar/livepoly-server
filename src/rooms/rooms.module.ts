import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { RoomsLobbyRepository } from './repositories/rooms-lobby.repository';
import { RoomsController } from './rooms.controller';
import { RoomsLobbyService } from './services/rooms-lobby.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    RateLimitModule,
    NotificationsModule,
    OutboxModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsLobbyService, RoomsLobbyRepository],
})
export class RoomsModule {}

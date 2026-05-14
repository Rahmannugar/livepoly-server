import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { SessionModule } from '../session/session.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { RateLimitModule } from 'src/rate-limit/rate-limit.module';
import { UsersRateLimitService } from './users-rate-limit.service';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../infra/queue/queue.constants';
import { UsersQueueService } from './users-queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.users }),
    DatabaseModule,
    AuthModule,
    SessionModule,
    ObservabilityModule,
    RateLimitModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    UsersRateLimitService,
    UsersQueueService,
  ],
  exports: [UsersQueueService],
})
export class UsersModule {}

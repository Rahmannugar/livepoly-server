import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { SessionModule } from '../session/session.module';
import { UsersQueueService } from './jobs/users-queue.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersRateLimitService } from './users-rate-limit.service';

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

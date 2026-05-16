import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { QUEUES } from '../infra/queue/queue.constants';
import { StorageModule } from '../infra/storage/storage.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { SessionModule } from '../session/session.module';
import { UsersQueueService } from './jobs/users-queue.service';
import { UsersProfileRepository } from './repositories/users-profile.repository';
import { UsersStatsRepository } from './repositories/users-stats.repository';
import { UsersMediaService } from './services/users-media.service';
import { UsersProfileService } from './services/users-profile.service';
import { UsersRateLimitService } from './services/users-rate-limit.service';
import { UsersStatsService } from './services/users-stats.service';
import { UsersController } from './users.controller';
import { UsersMediaRepository } from './repositories/users-media.repository';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.users }),
    DatabaseModule,
    AuthModule,
    SessionModule,
    ObservabilityModule,
    RateLimitModule,
    StorageModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersProfileService,
    UsersMediaService,
    UsersStatsService,
    UsersProfileRepository,
    UsersMediaRepository,
    UsersStatsRepository,
    UsersRateLimitService,
    UsersQueueService,
  ],
  exports: [UsersQueueService],
})
export class UsersModule {}

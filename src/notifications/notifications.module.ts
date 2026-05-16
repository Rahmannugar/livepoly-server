import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../infra/database/database.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { PubSubModule } from '../infra/pubsub/pubsub.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRateLimitService } from './notifications-rate-limit.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsStreamService } from './notifications-stream.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    ObservabilityModule,
    RateLimitModule,
    OutboxModule,
    PubSubModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsStreamService,
    NotificationsRepository,
    NotificationsRateLimitService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

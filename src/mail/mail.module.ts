import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../infra/queue/queue.constants';
import { CacheModule } from '../infra/cache/cache.module';
import { ObservabilityModule } from '../infra/observability/observability.module';
import { JobsModule } from '../jobs/jobs.module';
import { MailQueueService } from './jobs/mail-queue.service';
import { MAIL_CLIENT } from './mail.types';
import { MailService } from './mail.service';
import { ResendMailClient } from './resend-mail.client';
import { ResendWebhookController } from './webhooks/resend-webhook.controller';
import { ResendWebhookService } from './webhooks/resend-webhook.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.mail }),
    CacheModule,
    JobsModule,
    ObservabilityModule,
  ],
  controllers: [ResendWebhookController],
  providers: [
    ResendMailClient,
    {
      provide: MAIL_CLIENT,
      useExisting: ResendMailClient,
    },
    ResendWebhookService,
    MailService,
    MailQueueService,
  ],
  exports: [MailService, MailQueueService, BullModule],
})
export class MailModule {}

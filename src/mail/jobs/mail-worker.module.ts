import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../../infra/observability/observability.module';
import { JobsModule } from '../../jobs/jobs.module';
import { MailModule } from '../mail.module';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [MailModule, JobsModule, ObservabilityModule],
  providers: [MailProcessor],
})
export class MailWorkerModule {}

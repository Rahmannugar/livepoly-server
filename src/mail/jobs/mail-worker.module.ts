import { Module } from '@nestjs/common';
import { JobsModule } from '../../jobs/jobs.module';
import { MailModule } from '../mail.module';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [MailModule, JobsModule],
  providers: [MailProcessor],
})
export class MailWorkerModule {}

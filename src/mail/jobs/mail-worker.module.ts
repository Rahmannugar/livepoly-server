import { Module } from '@nestjs/common';
import { MailModule } from '../mail.module';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [MailModule],
  providers: [MailProcessor],
})
export class MailWorkerModule {}

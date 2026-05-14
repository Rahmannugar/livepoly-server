import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from './users.module';
import { UsersProcessor } from './users.processor';

@Module({
  imports: [UsersModule, MailModule],
  providers: [UsersProcessor],
})
export class UsersWorkerModule {}

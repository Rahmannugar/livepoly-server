import { Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { UsersModule } from '../users.module';
import { UsersProcessor } from './users.processor';
import { CacheModule } from '../../infra/cache/cache.module';

@Module({
  imports: [UsersModule, MailModule, CacheModule],
  providers: [UsersProcessor],
})
export class UsersWorkerModule {}

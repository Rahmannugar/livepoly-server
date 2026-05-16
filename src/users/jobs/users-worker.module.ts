import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '../../infra/cache/cache.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { StorageModule } from '../../infra/storage/storage.module';
import { MailModule } from '../../mail/mail.module';
import { UsersProcessor } from './users.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.users }),
    MailModule,
    CacheModule,
    StorageModule,
  ],
  providers: [UsersProcessor],
})
export class UsersWorkerModule {}

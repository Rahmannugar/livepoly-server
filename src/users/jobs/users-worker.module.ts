import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CacheModule } from '../../infra/cache/cache.module';
import { DatabaseModule } from '../../infra/database/database.module';
import { QUEUES } from '../../infra/queue/queue.constants';
import { StorageModule } from '../../infra/storage/storage.module';
import { MailModule } from '../../mail/mail.module';
import { UsersMediaRepository } from '../repositories/users-media.repository';
import { UsersProcessor } from './users.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.users }),
    MailModule,
    CacheModule,
    StorageModule,
    DatabaseModule,
  ],
  providers: [UsersProcessor, UsersMediaRepository],
})
export class UsersWorkerModule {}

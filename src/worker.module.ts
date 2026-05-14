import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './infra/database/database.module';
import { QueueModule } from './infra/queue/queue.module';
import { MailWorkerModule } from './mail/mail-worker.module';
import { UsersWorkerModule } from './users/users-worker.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    QueueModule,
    MailWorkerModule,
    UsersWorkerModule,
  ],
})
export class WorkerModule {}

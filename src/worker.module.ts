import { Module } from '@nestjs/common';
import { LoggingModule } from './common/logging/logging.module';
import { AppConfigModule } from './config/app-config.module';
import { GameBotWorkerModule } from './game/bots/game-bot-worker.module';
import { DatabaseModule } from './infra/database/database.module';
import { QueueModule } from './infra/queue/queue.module';
import { MailWorkerModule } from './mail/jobs/mail-worker.module';
import { OutboxWorkerModule } from './outbox/jobs/outbox-worker.module';
import { UsersWorkerModule } from './users/jobs/users-worker.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    QueueModule,
    MailWorkerModule,
    UsersWorkerModule,
    OutboxWorkerModule,
    GameBotWorkerModule,
  ],
})
export class WorkerModule {}

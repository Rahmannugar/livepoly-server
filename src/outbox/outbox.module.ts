import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infra/database/database.module';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxRepository],
  exports: [OutboxService],
})
export class OutboxModule {}

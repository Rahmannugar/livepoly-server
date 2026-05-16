import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infra/database/database.module';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  imports: [DatabaseModule],
  providers: [JobsRepository, JobsService],
  exports: [JobsService],
})
export class JobsModule {}

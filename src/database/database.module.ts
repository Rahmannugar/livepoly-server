import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE, createDatabaseClient } from './database.client';

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: createDatabaseClient,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}

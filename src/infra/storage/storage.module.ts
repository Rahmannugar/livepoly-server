import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { R2StorageClient } from './r2-storage.client';
import { StorageService } from './storage.service';
import { STORAGE_CLIENT } from './storage.types';

@Module({
  imports: [ConfigModule],
  providers: [
    R2StorageClient,
    {
      provide: STORAGE_CLIENT,
      useExisting: R2StorageClient,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}

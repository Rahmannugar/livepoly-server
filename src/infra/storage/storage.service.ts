import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_CLIENT } from './storage.types';
import type {
  CreatePresignedUploadInput,
  StorageClient,
} from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_CLIENT)
    private readonly storageClient: StorageClient,
  ) {}

  createPresignedUploadUrl(input: CreatePresignedUploadInput) {
    return this.storageClient.createPresignedUploadUrl(input);
  }

  objectExists(objectKey: string) {
    return this.storageClient.objectExists(objectKey);
  }

  deleteObject(objectKey: string) {
    return this.storageClient.deleteObject(objectKey);
  }
}

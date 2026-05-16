export type CreatePresignedUploadInput = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

export type StorageClient = {
  createPresignedUploadUrl(input: CreatePresignedUploadInput): Promise<string>;
  objectExists(objectKey: string): Promise<boolean>;
  deleteObject(objectKey: string): Promise<void>;
};

export const STORAGE_CLIENT = Symbol('STORAGE_CLIENT');

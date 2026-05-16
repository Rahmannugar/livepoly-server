export type CreatePresignedUploadInput = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

export type StorageObjectMetadata = {
  contentType: string | null;
  contentLength: number | null;
};

export type StorageClient = {
  createPresignedUploadUrl(input: CreatePresignedUploadInput): Promise<string>;
  getObjectMetadata(objectKey: string): Promise<StorageObjectMetadata | null>;
  getObjectBytes(
    objectKey: string,
    byteRange: string,
  ): Promise<Uint8Array | null>;
  deleteObject(objectKey: string): Promise<void>;
};

export const STORAGE_CLIENT = Symbol('STORAGE_CLIENT');

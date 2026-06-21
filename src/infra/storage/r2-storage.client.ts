import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  CreatePresignedUploadInput,
  StorageClient,
} from './storage.types';

@Injectable()
export class R2StorageClient implements StorageClient {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.getOrThrow<string>(
        'R2_ACCOUNT_ID',
      )}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  async getObjectMetadata(objectKey: string) {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
        }),
      );

      return {
        contentType: response.ContentType ?? null,
        contentLength: response.ContentLength ?? null,
      };
    } catch (error) {
      if (getHttpStatusCode(error) === 404) {
        return null;
      }

      throw error;
    }
  }

  async createPresignedUploadUrl(input: CreatePresignedUploadInput) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.objectKey,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      { expiresIn: 10 * 60 },
    );
  }

  async getObjectBytes(objectKey: string, byteRange: string) {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          Range: byteRange,
        }),
      );

      if (!response.Body) {
        return null;
      }

      return response.Body.transformToByteArray();
    } catch (error) {
      if (getHttpStatusCode(error) === 404) {
        return null;
      }

      throw error;
    }
  }

  async deleteObject(objectKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }),
    );
  }
}

function getHttpStatusCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const metadata = (error as Record<string, unknown>)['$metadata'];

  if (typeof metadata !== 'object' || metadata === null) {
    return null;
  }

  const statusCode = (metadata as Record<string, unknown>)['httpStatusCode'];

  return typeof statusCode === 'number' ? statusCode : null;
}

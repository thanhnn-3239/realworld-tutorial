import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  StorageDriver,
  StoragePutMeta,
} from '../storage-driver.interface';
import { createS3Client, requireConfig } from '../file-storage.config';

@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(configService: ConfigService) {
    this.s3 = createS3Client(configService);
    this.bucket = requireConfig(configService, 'STORAGE_BUCKET');
    this.publicUrl = requireConfig(configService, 'STORAGE_PUBLIC_URL');
  }

  async put(key: string, body: Buffer, meta: StoragePutMeta): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
        ContentLength: meta.contentLength,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ...(continuationToken
            ? { ContinuationToken: continuationToken }
            : {}),
        }),
      );

      for (const object of response.Contents ?? []) {
        if (object.Key) {
          keys.push(object.Key);
        }
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  url(key: string): string {
    return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
  }
}

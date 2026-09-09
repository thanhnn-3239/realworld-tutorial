import { CreateBucketCommand } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';

import { createS3Client } from '../../src/file-storage/file-storage.config';

/**
 * Reuses the application's own S3 wiring outside a Nest context by answering
 * `get` from the environment, so the suite and the service under test cannot
 * drift apart on endpoint or credentials.
 */
const environmentConfig = {
  get: <T>(key: string, defaultValue?: T) =>
    (process.env[key] as T | undefined) ?? defaultValue,
} as unknown as ConfigService;

/**
 * The upload specs write to a real bucket. Creating it here rather than relying
 * on `docker/minio-init.sh` keeps a fresh clone and a CI runner — neither of
 * which has run that script — from failing every suite at application boot.
 */
export async function prepareStorageBackend(): Promise<void> {
  const bucket = process.env.STORAGE_BUCKET;

  if (!bucket) {
    throw new Error(
      'STORAGE_BUCKET is not set; the application refuses to boot without it, so no e2e suite can start.',
    );
  }

  const s3 = createS3Client(environmentConfig);

  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') {
      throw error;
    }
  } finally {
    s3.destroy();
  }
}

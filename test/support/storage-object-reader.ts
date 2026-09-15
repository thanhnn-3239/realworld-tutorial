import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';

import type { StoredTestObject } from './interfaces/stored-test-object.interface';

/**
 * Authenticated, test-only object inspection: reads a stored object's body and
 * metadata straight from MinIO via the SDK the same way the real
 * `S3StorageDriver` writes it, so E2E assertions can verify content type and
 * decoded bytes without ever performing an anonymous HTTP GET or widening the
 * production `StorageDriver` surface.
 */
export async function readStoredObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<StoredTestObject> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`Object ${key} in bucket ${bucket} returned no body`);
  }

  const bytes = await response.Body.transformToByteArray();

  return {
    body: Buffer.from(bytes),
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

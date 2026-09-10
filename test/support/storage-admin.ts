import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

import { runCleanupSteps } from './cleanup';
import type { E2eBaseConfig } from './e2e-config';
import { assertSafeBucketName, suiteBucketName } from './e2e-resource-names';

const DELETE_BATCH_SIZE = 1_000;

export interface TestBucket {
  readonly name: string;
  list(prefix?: string, pageSize?: number): Promise<string[]>;
  clear(pageSize?: number): Promise<void>;
  drop(): Promise<void>;
}

function createClient(config: E2eBaseConfig): S3Client {
  return new S3Client({
    endpoint: config.storageEndpoint,
    region: config.storageRegion,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.storageAccessKey,
      secretAccessKey: config.storageSecretKey,
    },
  });
}

async function listKeys(
  client: S3Client,
  bucket: string,
  prefix?: string,
  pageSize?: number,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: pageSize,
        ContinuationToken: continuationToken,
      }),
    );
    keys.push(
      ...(response.Contents ?? []).flatMap((object) =>
        object.Key ? [object.Key] : [],
      ),
    );
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

function bucketHandle(
  config: E2eBaseConfig,
  runId: string,
  name: string,
): TestBucket {
  const client = createClient(config);

  async function clear(pageSize?: number): Promise<void> {
    assertSafeBucketName(name, runId);
    const keys = await listKeys(client, name, undefined, pageSize);

    for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: name,
          ChecksumAlgorithm: 'MD5',
          Delete: {
            Objects: keys
              .slice(index, index + DELETE_BATCH_SIZE)
              .map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    }
  }

  return {
    name,
    list: (prefix, pageSize) => listKeys(client, name, prefix, pageSize),
    clear,
    async drop() {
      await runCleanupSteps(`Cleanup failed for test bucket ${name}`, [
        clear,
        async () => {
          assertSafeBucketName(name, runId);
          await client.send(new DeleteBucketCommand({ Bucket: name }));
        },
        () => Promise.resolve(client.destroy()),
      ]);
    },
  };
}

export async function assertStorageReady(config: E2eBaseConfig): Promise<void> {
  const client = createClient(config);

  try {
    await client.send(new ListBucketsCommand({}));
  } catch (error) {
    const name = (error as { name?: string }).name ?? 'UnknownError';
    throw new Error(
      `MinIO is not ready at ${config.storageEndpoint}: ${name}`,
      { cause: error },
    );
  } finally {
    client.destroy();
  }
}

export async function createTestBucket(
  config: E2eBaseConfig,
  runId: string,
  label: string,
): Promise<TestBucket> {
  const name = suiteBucketName(runId, label);
  const client = createClient(config);

  try {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    return bucketHandle(config, runId, name);
  } finally {
    client.destroy();
  }
}

export async function sweepRunBuckets(
  config: E2eBaseConfig,
  runId: string,
): Promise<void> {
  const client = createClient(config);

  try {
    const response = await client.send(new ListBucketsCommand({}));
    const names = (response.Buckets ?? []).flatMap((bucket) =>
      bucket.Name?.startsWith(`e2e-${runId}-`) ? [bucket.Name] : [],
    );

    await runCleanupSteps(
      `Cleanup failed for E2E run ${runId} buckets`,
      names.map((name) => async () => {
        assertSafeBucketName(name, runId);
        await bucketHandle(config, runId, name).drop();
      }),
    );
  } finally {
    client.destroy();
  }
}

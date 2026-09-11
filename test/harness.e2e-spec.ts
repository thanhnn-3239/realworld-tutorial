import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { runCleanupSteps } from './support/cleanup';
import { assertSafeDatabaseName } from './support/database-admin';
import { registerDatabaseHarnessCases } from './support/database-harness-cases';
import { readE2eBaseConfig } from './support/e2e-config';
import { createTestBucket } from './support/storage-admin';

const HOOK_TIMEOUT_MS = 60_000;

describe('e2e harness', () => {
  registerDatabaseHarnessCases();

  it('từ chối thao tác trên database ngoài namespace của harness', () => {
    expect(() => assertSafeDatabaseName('realworld', 'a1b2c3d4e5f6')).toThrow(
      /outside run/,
    );
  });

  it('từ chối thao tác trên database gốc của e2e', () => {
    const baseName = new URL(process.env.DATABASE_URL ?? '').pathname.replace(
      /^\//u,
      '',
    );

    expect(() => assertSafeDatabaseName(baseName, 'a1b2c3d4e5f6')).toThrow(
      /base e2e database/,
    );
  });

  it('giữ lại mọi lỗi khi nhiều bước cleanup cùng thất bại', async () => {
    const databaseError = new Error('database cleanup failed');
    const storageError = new Error('storage cleanup failed');

    await expect(
      runCleanupSteps('harness cleanup failed', [
        async () => Promise.reject(databaseError),
        async () => Promise.reject(storageError),
      ]),
    ).rejects.toMatchObject({
      errors: [databaseError, storageError],
      message: 'harness cleanup failed',
    });
  });

  it(
    'cô lập bucket và xoá đủ object qua nhiều trang',
    async () => {
      const config = readE2eBaseConfig();
      const runId = process.env.E2E_RUN_ID;

      if (!runId) {
        throw new Error('E2E_RUN_ID is required');
      }

      const first = await createTestBucket(config, runId, 'harness-first');
      const second = await createTestBucket(config, runId, 'harness-second');
      const client = new S3Client({
        endpoint: config.storageEndpoint,
        region: config.storageRegion,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.storageAccessKey,
          secretAccessKey: config.storageSecretKey,
        },
      });

      try {
        await Promise.all([
          ...['one', 'two', 'three'].map((key) =>
            client.send(
              new PutObjectCommand({
                Bucket: first.name,
                Key: key,
                Body: key,
              }),
            ),
          ),
          client.send(
            new PutObjectCommand({
              Bucket: second.name,
              Key: 'keep',
              Body: 'keep',
            }),
          ),
        ]);

        await first.clear(2);

        await expect(first.list()).resolves.toEqual([]);
        await expect(second.list()).resolves.toEqual(['keep']);
      } finally {
        client.destroy();
        await runCleanupSteps('bucket harness cleanup failed', [
          () => first.drop(),
          () => second.drop(),
        ]);
      }
    },
    HOOK_TIMEOUT_MS,
  );
});

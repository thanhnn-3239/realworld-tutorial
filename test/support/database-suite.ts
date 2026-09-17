import { ConfigService } from '@nestjs/config';

import { PasswordService } from '../../src/common/password/password.service';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { runCleanupSteps } from './cleanup';
import { readE2eBaseConfig } from './e2e-config';
import {
  createDatabaseFixtureFactory,
  type DatabaseFixtureFactory,
} from './fixtures/fixture-factory';
import { createTestBucket, type TestBucket } from './storage-admin';
import { createTestDatabase, type TestDatabase } from './test-database';

const HOOK_TIMEOUT_MS = 60_000;

export interface DatabaseContext {
  readonly databaseUrl: string;
  readonly prisma: PrismaClient;
  readonly fixtures: DatabaseFixtureFactory;
}

interface DatabaseSuiteState {
  readonly bucket: TestBucket;
  readonly database: TestDatabase;
  readonly fixtures: DatabaseFixtureFactory;
  readonly prisma: PrismaClient;
}

function requireRunId(): string {
  const runId = process.env.E2E_RUN_ID;

  if (!runId) {
    throw new Error('E2E_RUN_ID is missing; run through test/jest-e2e.json');
  }

  return runId;
}

function passwordService(): PasswordService {
  const config = {
    get: <T>(key: string, defaultValue?: T) =>
      (process.env[key] ?? defaultValue) as T,
  } as unknown as ConfigService;

  return new PasswordService(config);
}

export function useDatabaseSuite(label: string): DatabaseContext {
  let state: DatabaseSuiteState | undefined;

  function current(): DatabaseSuiteState {
    if (!state) {
      throw new Error(`Database suite ${label} is not initialized`);
    }
    return state;
  }

  beforeAll(async () => {
    const config = readE2eBaseConfig();
    const runId = requireRunId();
    const database = await createTestDatabase(label);
    let bucket: TestBucket | undefined;

    try {
      bucket = await createTestBucket(config, runId, label);
      const prisma = await database.client();
      state = {
        bucket,
        database,
        prisma,
        fixtures: createDatabaseFixtureFactory({
          prisma,
          passwordService: passwordService(),
        }),
      };
    } catch (error) {
      await runCleanupSteps(`Setup cleanup failed for ${label}`, [
        async () => bucket?.drop(),
        () => database.drop(),
      ]).catch((cleanupError) => {
        throw new AggregateError(
          [error, cleanupError],
          `Setup failed for database suite ${label}`,
        );
      });
      throw error;
    }
  }, HOOK_TIMEOUT_MS);

  beforeEach(async () => {
    await current().database.reset();
    await current().bucket.clear();
    current().fixtures.resetSequence();
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    if (state) {
      await runCleanupSteps(`Cleanup failed for database suite ${label}`, [
        () => state!.bucket.drop(),
        () => state!.database.drop(),
      ]);
      state = undefined;
    }
  }, HOOK_TIMEOUT_MS);

  return {
    get databaseUrl() {
      return current().database.url;
    },
    get prisma() {
      return current().prisma;
    },
    get fixtures() {
      return current().fixtures;
    },
  };
}

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { TokenService } from '../../src/auth/token/token.service';
import { PasswordService } from '../../src/common/password/password.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { runCleanupSteps } from './cleanup';
import { buildE2eSuiteConfig, readE2eBaseConfig } from './e2e-config';
import { createTestApp } from './test-app';
import { createTestBucket, type TestBucket } from './storage-admin';
import { createTestDatabase, type TestDatabase } from './test-database';
import {
  createFixtureFactory,
  type FixtureFactory,
} from './fixtures/fixture-factory';

const HOOK_TIMEOUT_MS = 60_000;

export interface E2eContext {
  readonly databaseUrl: string;
  readonly request: ReturnType<typeof request>;
  readonly prisma: PrismaService;
  readonly fixtures: FixtureFactory;
  resolve<T>(token: unknown): T;
}

interface E2eSuiteState {
  readonly app: INestApplication<App>;
  readonly bucket: TestBucket;
  readonly database: TestDatabase;
  readonly fixtures: FixtureFactory;
  readonly prisma: PrismaService;
  readonly request: ReturnType<typeof request>;
}

interface PartialE2eSuiteState {
  app?: INestApplication<App>;
  bucket?: TestBucket;
  database?: TestDatabase;
}

function requireRunId(): string {
  const runId = process.env.E2E_RUN_ID;

  if (!runId) {
    throw new Error('E2E_RUN_ID is missing; run through test/jest-e2e.json');
  }

  return runId;
}

async function cleanupState(state: PartialE2eSuiteState): Promise<void> {
  await runCleanupSteps('E2E suite cleanup failed', [
    async () => state.app?.close(),
    async () => state.bucket?.drop(),
    async () => state.database?.drop(),
  ]);
}

export function useE2eSuite(label: string): E2eContext {
  let state: E2eSuiteState | undefined;

  function current(): E2eSuiteState {
    if (!state) {
      throw new Error(`E2E suite ${label} is not initialized`);
    }

    return state;
  }

  beforeAll(async () => {
    const partial: PartialE2eSuiteState = {};

    try {
      const baseConfig = readE2eBaseConfig();
      const runId = requireRunId();
      partial.database = await createTestDatabase(label);
      partial.bucket = await createTestBucket(baseConfig, runId, label);
      const suiteConfig = buildE2eSuiteConfig(
        baseConfig,
        partial.database.name,
        partial.bucket.name,
      );
      partial.app = await createTestApp(partial.database, suiteConfig);
      const prisma = partial.app.get(PrismaService);
      const fixtures = createFixtureFactory({
        prisma,
        passwordService: partial.app.get(PasswordService),
        tokenService: partial.app.get(TokenService),
      });
      state = {
        app: partial.app,
        bucket: partial.bucket,
        database: partial.database,
        fixtures,
        prisma,
        request: request(partial.app.getHttpServer()),
      };
    } catch (error) {
      try {
        await cleanupState(partial);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Setup failed for E2E suite ${label}`,
        );
      }
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
      await cleanupState(state);
      state = undefined;
    }
  }, HOOK_TIMEOUT_MS);

  return {
    get databaseUrl() {
      return current().database.url;
    },
    get request() {
      return current().request;
    },
    get prisma() {
      return current().prisma;
    },
    get fixtures() {
      return current().fixtures;
    },
    resolve<T>(token: unknown): T {
      return current().app.get(token as never);
    },
  };
}

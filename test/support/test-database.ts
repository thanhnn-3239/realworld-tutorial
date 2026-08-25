import { randomBytes } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../src/generated/prisma/client';
import {
  assertSafeDatabaseName,
  databaseUrlFor,
  withAdminConnection,
} from './database-admin';

export interface TestDatabase {
  readonly url: string;
  /** Connects on first call, so a suite that never queries opens no connection. */
  client(): Promise<PrismaClient>;
  /** Disconnects first, so the drop never has to force-terminate our own session. */
  drop(): Promise<void>;
}

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `${key} is missing. e2e specs must run through test/jest-e2e.json so globalSetup can provision the template database.`,
    );
  }

  return value;
}

/**
 * Uniqueness comes from the random suffix; `label` only makes the database
 * recognisable while debugging. Restrict it to `[a-z0-9_]` or the name will
 * fail `assertSafeDatabaseName` and nothing will be created.
 *
 * Unlike the admin layer this runs inside the test environment, where
 * `moduleNameMapper` is in effect and the generated Prisma Client resolves.
 */
export async function createTestDatabase(label: string): Promise<TestDatabase> {
  const runId = requireEnv('E2E_RUN_ID');
  const templateName = requireEnv('E2E_TEMPLATE_DB');
  const adminUrl = requireEnv('E2E_ADMIN_URL');

  const name = `e2e_${runId}_${label}_${randomBytes(4).toString('hex')}`;
  assertSafeDatabaseName(name);

  await withAdminConnection(adminUrl, (admin) =>
    admin.execute(`CREATE DATABASE "${name}" TEMPLATE "${templateName}"`),
  );

  const url = databaseUrlFor(adminUrl, name);
  let client: PrismaClient | undefined;

  return {
    url,

    async client() {
      if (!client) {
        client = new PrismaClient({
          adapter: new PrismaPg({ connectionString: url }),
        });
        await client.$connect();
      }

      return client;
    },

    async drop() {
      // Both failures are collected rather than thrown: a disconnect error must
      // not stop the drop, or the database would leak until globalTeardown.
      const cleanupErrors: unknown[] = [];

      try {
        await client?.$disconnect();
      } catch (error) {
        cleanupErrors.push(error);
      }

      try {
        assertSafeDatabaseName(name);
        await withAdminConnection(adminUrl, (admin) =>
          admin.execute(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
        );
      } catch (error) {
        cleanupErrors.push(error);
      }

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          `Cleanup failed for test database ${name}`,
        );
      }
    },
  };
}

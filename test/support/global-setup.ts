import 'dotenv/config';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

import {
  assertSafeDatabaseName,
  databaseUrlFor,
  withAdminConnection,
} from './database-admin';
import { readE2eBaseConfig } from './e2e-config';
import { templateDatabaseName } from './e2e-resource-names';
import { assertStorageReady } from './storage-admin';

const MIGRATION_TIMEOUT_MS = 45_000;

const execFileAsync = promisify(execFile);

/**
 * Migrates once per run instead of once per suite: suites then clone the result
 * with `CREATE DATABASE ... TEMPLATE`, which costs ~100ms against the ~1-2s of
 * spawning the Prisma CLI.
 *
 * PostgreSQL refuses to clone a template while any session is attached to it.
 * That holds here because `prisma migrate deploy` runs in a child process which
 * has fully exited by the time `execFileAsync` resolves — so nothing in this
 * file may open a connection to the template afterwards.
 *
 * The three variables written at the end reach the workers because Jest
 * inherits `process.env` from globalSetup into the test environment.
 */
export default async function globalSetup(): Promise<void> {
  const config = readE2eBaseConfig();
  const applicationDatabaseUrl = config.databaseUrl;
  const runId = randomBytes(6).toString('hex');
  const templateName = templateDatabaseName(runId);
  const adminUrl = databaseUrlFor(applicationDatabaseUrl, 'postgres');
  const templateUrl = databaseUrlFor(applicationDatabaseUrl, templateName);

  await withAdminConnection(adminUrl, () => Promise.resolve());
  await assertStorageReady(config);
  assertSafeDatabaseName(templateName, runId);
  await withAdminConnection(adminUrl, (admin) =>
    admin.execute(`CREATE DATABASE "${templateName}"`),
  );

  try {
    await execFileAsync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        env: { ...process.env, DATABASE_URL: templateUrl },
        timeout: MIGRATION_TIMEOUT_MS,
      },
    );
  } catch (error) {
    await withAdminConnection(adminUrl, async (admin) => {
      assertSafeDatabaseName(templateName, runId);
      await admin.execute(
        `DROP DATABASE IF EXISTS "${templateName}" WITH (FORCE)`,
      );
    });
    throw error;
  }

  process.env.E2E_RUN_ID = runId;
  process.env.E2E_TEMPLATE_DB = templateName;
  process.env.E2E_ADMIN_URL = adminUrl;
}

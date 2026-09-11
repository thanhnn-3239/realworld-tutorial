import { runCleanupSteps } from './cleanup';
import { assertSafeDatabaseName, withAdminConnection } from './database-admin';
import { readE2eBaseConfig } from './e2e-config';
import { sweepRunBuckets } from './storage-admin';

/**
 * Sweeps by `e2e_<runId>_` prefix rather than tracking what was created, so a
 * clone orphaned by a SIGKILLed suite still gets collected. Scoping the sweep
 * to this run's id is what makes it safe to run against a shared PostgreSQL
 * while other runs are in flight.
 *
 * Returns quietly when the variables are absent: globalSetup failed before
 * provisioning anything, and its error is the one worth surfacing.
 */
export default async function globalTeardown(): Promise<void> {
  const runId = process.env.E2E_RUN_ID;
  const adminUrl = process.env.E2E_ADMIN_URL;

  if (!runId || !adminUrl) {
    return;
  }

  const config = readE2eBaseConfig();

  await runCleanupSteps(`Cleanup failed for E2E run ${runId}`, [
    async () => {
      await withAdminConnection(adminUrl, async (admin) => {
        const names = await admin.listDatabases(`e2e_${runId}_%`);

        for (const name of names) {
          assertSafeDatabaseName(name, runId);
          await admin.execute(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
        }
      });
    },
    () => sweepRunBuckets(config, runId),
  ]);
}

import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Guards every DROP the harness issues. The `runId` segment is what stops
 * parallel runs on a shared PostgreSQL from deleting each other's databases.
 *
 * Matches the template (`e2e_<runId>_tpl`) and clones
 * (`e2e_<runId>_<label>_<hex>`).
 */
export const SAFE_TEST_DATABASE_NAME = /^e2e_[a-f0-9]{12}_[a-z0-9_]+$/u;

export function assertSafeDatabaseName(name: string): void {
  if (!SAFE_TEST_DATABASE_NAME.test(name)) {
    throw new Error(
      `Refusing to operate on a database outside the harness namespace: ${name}`,
    );
  }
}

/** Rewrites the path segment only, so host and credentials survive untouched. */
export function databaseUrlFor(baseUrl: string, name: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  url.search = '';
  return url.toString();
}

/**
 * Deliberately narrow: these two operations are everything the harness needs,
 * which is what keeps the driver-adapter API from leaking past this file.
 */
export interface AdminConnection {
  /** Runs outside a transaction — CREATE/DROP DATABASE cannot run inside one. */
  execute(sql: string): Promise<void>;
  listDatabases(likePattern: string): Promise<string[]>;
}

/**
 * Talks to the driver adapter rather than Prisma Client because `globalSetup`
 * runs outside Jest's module registry: `moduleNameMapper` does not apply there,
 * and the generated client imports its internals with a `.js` extension that
 * only resolves once that mapping is in effect.
 *
 * The driver-adapter contract is less stable than a public API, so it is sealed
 * behind `AdminConnection` — if Prisma changes it, only this file moves.
 */
export async function withAdminConnection<T>(
  adminUrl: string,
  fn: (admin: AdminConnection) => Promise<T>,
): Promise<T> {
  const adapter = await new PrismaPg({ connectionString: adminUrl }).connect();

  try {
    return await fn({
      async execute(sql) {
        await adapter.executeScript(sql);
      },

      async listDatabases(likePattern) {
        const result = await adapter.queryRaw({
          sql: 'SELECT datname FROM pg_database WHERE datname LIKE $1',
          args: [likePattern],
          argTypes: ['Text'],
        });

        return result.rows.map((row) => String(row[0]));
      },
    });
  } finally {
    await adapter.dispose();
  }
}

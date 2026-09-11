import { PrismaPg } from '@prisma/adapter-pg';

import { assertSafeDatabaseName as assertRunNamespacedDatabaseName } from './e2e-resource-names';

/**
 * The live e2e application database (e.g. `realworld_e2e`), read from the
 * same ambient `DATABASE_URL` that `global-setup.ts` reads directly. This
 * process never mutates that variable, so every caller observes the same
 * value for its whole lifetime.
 */
function readBaseDatabaseName(): string | undefined {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return undefined;
  }

  return new URL(url).pathname.replace(/^\//u, '') || undefined;
}

/**
 * Guards every CREATE/DROP the harness issues, on top of the central
 * run-namespace guard in `e2e-resource-names.ts`. The base-database check
 * runs first and independently of that regex: even if the namespace pattern
 * were ever loosened, a clone operation could still never target the live
 * e2e application database itself.
 */
export function assertSafeDatabaseName(name: string, runId: string): void {
  const base = readBaseDatabaseName();

  if (base !== undefined && name === base) {
    throw new Error(`Refusing to operate on the base e2e database: ${name}`);
  }

  assertRunNamespacedDatabaseName(name, runId);
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
          argTypes: [{ scalarType: 'string', arity: 'scalar' }],
        });

        return result.rows.map((row) => String(row[0]));
      },
    });
  } finally {
    await adapter.dispose();
  }
}

import { PrismaPg } from '@prisma/adapter-pg';

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/gu, '""')}"`;
}

export async function resetApplicationTables(
  databaseUrl: string,
): Promise<void> {
  const adapter = await new PrismaPg({
    connectionString: databaseUrl,
  }).connect();

  try {
    const result = await adapter.queryRaw({
      sql: `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
        ORDER BY tablename
      `,
      args: [],
      argTypes: [],
    });
    const tables = result.rows.map((row) => quoteIdentifier(String(row[0])));

    if (tables.length > 0) {
      await adapter.executeScript(
        `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await adapter.dispose();
  }
}

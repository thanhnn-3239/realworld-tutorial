import { assertSafeDatabaseName } from './support/database-admin';
import { createTestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('e2e harness', () => {
  it(
    'clone ra một schema đã migrate và rỗng',
    async () => {
      const db = await createTestDatabase('harness_schema');

      try {
        const prisma = await db.client();

        await expect(prisma.user.count()).resolves.toBe(0);
        await expect(prisma.article.count()).resolves.toBe(0);
      } finally {
        await db.drop();
      }
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'cô lập database của suite này với suite khác',
    async () => {
      const first = await createTestDatabase('harness_first');
      const second = await createTestDatabase('harness_second');

      try {
        const firstPrisma = await first.client();
        await firstPrisma.user.create({
          data: {
            email: 'harness-first@example.com',
            username: 'harness_first',
            password: 'hashed-for-test',
          },
        });

        const secondPrisma = await second.client();
        await expect(secondPrisma.user.count()).resolves.toBe(0);
      } finally {
        await Promise.all([first.drop(), second.drop()]);
      }
    },
    HOOK_TIMEOUT_MS,
  );

  it('từ chối thao tác trên database ngoài namespace của harness', () => {
    expect(() => assertSafeDatabaseName('realworld')).toThrow(
      /outside the harness namespace/,
    );
  });
});

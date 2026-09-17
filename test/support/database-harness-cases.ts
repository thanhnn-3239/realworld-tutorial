import { createTestDatabase } from './test-database';

const HOOK_TIMEOUT_MS = 60_000;

export function registerDatabaseHarnessCases(): void {
  it(
    'clone ra một schema đã migrate và rỗng',
    async () => {
      const db = await createTestDatabase('harness-schema');

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
      const first = await createTestDatabase('harness-first');
      const second = await createTestDatabase('harness-second');

      try {
        const firstPrisma = await first.client();
        await firstPrisma.user.create({
          data: {
            email: 'harness-first@example.com',
            username: 'harness_first',
            password: 'hashed-for-test',
          },
        });
        await expect((await second.client()).user.count()).resolves.toBe(0);
      } finally {
        await Promise.all([first.drop(), second.drop()]);
      }
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'reset bảng ứng dụng, giữ migrations và restart identity',
    async () => {
      const db = await createTestDatabase('harness-reset');

      try {
        const prisma = await db.client();
        await prisma.user.create({
          data: {
            email: 'before-reset@example.com',
            username: 'before_reset',
            password: 'hashed-for-test',
          },
        });
        await db.reset();

        await expect(prisma.user.count()).resolves.toBe(0);
        const migrations = await prisma.$queryRawUnsafe<{ count: number }[]>(
          'SELECT count(*)::int AS count FROM "_prisma_migrations"',
        );
        expect(migrations[0]?.count).toBeGreaterThan(0);

        const firstAfterReset = await prisma.user.create({
          data: {
            email: 'after-reset@example.com',
            username: 'after_reset',
            password: 'hashed-for-test',
          },
        });
        expect(firstAfterReset.id).toBe(1);
      } finally {
        await db.drop();
      }
    },
    HOOK_TIMEOUT_MS,
  );

  it(
    'reset hai database song song mà không ảnh hưởng lẫn nhau',
    async () => {
      const first = await createTestDatabase('harness-parallel-first');
      const second = await createTestDatabase('harness-parallel-second');

      try {
        const [firstPrisma, secondPrisma] = await Promise.all([
          first.client(),
          second.client(),
        ]);
        await Promise.all([
          firstPrisma.user.create({
            data: {
              email: 'parallel-first@example.com',
              username: 'parallel_first',
              password: 'hashed-for-test',
            },
          }),
          secondPrisma.user.create({
            data: {
              email: 'parallel-second@example.com',
              username: 'parallel_second',
              password: 'hashed-for-test',
            },
          }),
        ]);

        await Promise.all([first.reset(), second.reset()]);
        await expect(firstPrisma.user.count()).resolves.toBe(0);
        await expect(secondPrisma.user.count()).resolves.toBe(0);
      } finally {
        await Promise.all([first.drop(), second.drop()]);
      }
    },
    HOOK_TIMEOUT_MS,
  );
}

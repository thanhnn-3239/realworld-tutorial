import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HttpStatus } from '@nestjs/common';
import { comparePassword } from '../src/common/password/password.service';
import { useE2eSuite } from './support/e2e-suite';

const execFileAsync = promisify(execFile);

describe('Demo seed (e2e)', () => {
  const e2e = useE2eSuite('demo-seed');

  async function runSeed(databaseUrl: string, password: string) {
    await execFileAsync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'db', 'seed'],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DEMO_USER_PASSWORD: password,
        },
      },
    );
  }

  it('seeds idempotently, stores a bcrypt hash, and allows login', async () => {
    const password = 'password123';
    await runSeed(e2e.databaseUrl, password);
    await runSeed(e2e.databaseUrl, password);
    const seededUser = await e2e.prisma.user.findUniqueOrThrow({
      where: { email: 'demo@example.com' },
    });

    expect(
      await e2e.prisma.user.count({ where: { email: 'demo@example.com' } }),
    ).toBe(1);
    expect(
      await e2e.prisma.article.count({
        where: {
          slug: {
            in: [
              'prisma-adds-support-for-mongodb',
              'whats-new-in-prisma-q1-22',
            ],
          },
        },
      }),
    ).toBe(2);
    // The column is nullable now that provider-only accounts exist, but the seed always
    // writes a password — asserting that first is what lets the checks below stay strict.
    expect(seededUser.password).not.toBeNull();
    const seededHash = seededUser.password as string;

    expect(seededHash).not.toBe(password);
    expect(seededHash).toMatch(/^\$2[aby]\$/);
    await expect(comparePassword(password, seededHash)).resolves.toBe(true);

    await e2e.request
      .post('/v1/auth/login')
      .send({ email: 'demo@example.com', password })
      .expect(HttpStatus.OK);
  });
});

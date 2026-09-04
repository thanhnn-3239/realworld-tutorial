import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { comparePassword } from '../src/common/password/password.service';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const execFileAsync = promisify(execFile);
const HOOK_TIMEOUT_MS = 60_000;

describe('Demo seed (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;

  beforeAll(async () => {
    db = await createTestDatabase('demo_seed');
    await runSeed(db.url, 'password123');
    await runSeed(db.url, 'password123');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

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

  function httpServer() {
    if (!app) {
      throw new Error('Demo seed e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  it('seeds idempotently, stores a bcrypt hash, and allows login', async () => {
    if (!db) {
      throw new Error('Demo seed e2e database is not initialized');
    }

    const password = 'password123';
    const prisma = await db.client();
    const seededUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'demo@example.com' },
    });

    expect(
      await prisma.user.count({ where: { email: 'demo@example.com' } }),
    ).toBe(1);
    expect(
      await prisma.article.count({
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
    expect(seededUser.password).not.toBe(password);
    expect(seededUser.password).toMatch(/^\$2[aby]\$/);
    await expect(comparePassword(password, seededUser.password)).resolves.toBe(
      true,
    );

    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: 'demo@example.com', password })
      .expect(HttpStatus.OK);
  });
});

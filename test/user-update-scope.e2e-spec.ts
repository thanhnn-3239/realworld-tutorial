import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('User update scope (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  const fixtureId = Date.now().toString(36).slice(-5);
  const email = `scope-${fixtureId}@example.com`;
  const password = 'password123';
  let token: string;

  beforeAll(async () => {
    db = await createTestDatabase('userscope');
    app = await createTestApp(db);

    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email,
        username: `scope_${fixtureId}`,
        password,
        password_confirmation: password,
      })
      .expect(HttpStatus.CREATED);

    token = response.body.data.accessToken as string;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('User scope e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  it('updates the profile fields it still accepts', async () => {
    const response = await request(httpServer())
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'I write plans', image: 'https://example.com/a.png' })
      .expect(HttpStatus.OK);

    expect(response.body.data.bio).toBe('I write plans');
    expect(response.body.data.image).toBe('https://example.com/a.png');
  });

  it('silently ignores an email change and leaves the address intact', async () => {
    const response = await request(httpServer())
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `hijack-${fixtureId}@example.com` })
      .expect(HttpStatus.OK);

    expect(response.body.data.email).toBe(email);
  });

  it('silently ignores a password change, leaving the original password working', async () => {
    await request(httpServer())
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'a-different-password' })
      .expect(HttpStatus.OK);

    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'a-different-password' })
      .expect(HttpStatus.UNAUTHORIZED);

    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);
  });
});

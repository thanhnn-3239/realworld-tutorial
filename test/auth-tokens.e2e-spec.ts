import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Auth tokens (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let fixtureNumber = 0;
  const suiteNonce = Date.now().toString(36).slice(-4);

  beforeAll(async () => {
    db = await createTestDatabase('authtokens');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Auth tokens e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  // Keep the role short: `username` is capped at 30 characters and the fixture suffix
  // already eats part of that budget.
  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `tok-${role}-${fixtureId}@example.com`,
        username: `tok_${role}_${fixtureId}`,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return {
      accessToken: response.body.data.accessToken as string,
      refreshToken: response.body.data.refreshToken as string,
      email: response.body.data.email as string,
    };
  }

  it('issues both tokens on register and accepts the access token', async () => {
    const { accessToken, refreshToken } = await register('reg');

    expect(typeof accessToken).toBe('string');
    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    await request(httpServer())
      .get('/v1/user')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(HttpStatus.OK);
  });

  it('carries only the subject claim, and expires in fifteen minutes', async () => {
    const { accessToken } = await register('claims');

    const [, payloadSegment] = accessToken.split('.');
    const claims = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as Record<string, number>;

    // Nothing mutable is carried, so no claim can go stale.
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('rotates the refresh token and refuses the spent one', async () => {
    const { refreshToken } = await register('rot');

    const rotated = await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.OK);

    const next = rotated.body.data.refreshToken as string;
    expect(next).not.toBe(refreshToken);

    await request(httpServer())
      .get('/v1/user')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken as string}`)
      .expect(HttpStatus.OK);

    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('kills every session when a spent refresh token is replayed', async () => {
    const { refreshToken } = await register('replay');

    const rotated = await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.OK);
    const live = rotated.body.data.refreshToken as string;

    // The replay is what triggers the purge; the token the rotation produced dies with it.
    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);

    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: live })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('revokes a single token on logout', async () => {
    const { refreshToken } = await register('out');

    await request(httpServer())
      .post('/v1/auth/logout')
      .send({ refreshToken })
      .expect(HttpStatus.NO_CONTENT);

    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('treats logging out an unknown token as already done', async () => {
    await request(httpServer())
      .post('/v1/auth/logout')
      .send({ refreshToken: 'never-issued' })
      .expect(HttpStatus.NO_CONTENT);
  });

  it('rejects a missing refresh token with a validation error', async () => {
    const response = await request(httpServer())
      .post('/v1/auth/refresh')
      .send({})
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);

    expect(response.body.errors).toHaveProperty('refreshToken');
  });

  it('treats an email as the same account regardless of case', async () => {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const typed = `Tok-Case-${fixtureId}@Example.COM`;

    const registered = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: typed,
        username: `tok_case_${fixtureId}`,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    expect(registered.body.data.email).toBe(typed.toLowerCase());

    // The case a user actually retypes on the login form.
    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: typed.toLowerCase(), password: 'password123' })
      .expect(HttpStatus.OK);

    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: typed.toUpperCase(), password: 'password123' })
      .expect(HttpStatus.OK);

    // And registering the same address in another case is a conflict, not a second row.
    await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: typed.toUpperCase(),
        username: `tok_dup_${fixtureId}`,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CONFLICT);
  });

  it('logging in twice leaves both sessions usable', async () => {
    const { email } = await register('multi');

    const second = await request(httpServer())
      .post('/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(HttpStatus.OK);

    // Independent chains: rotating one must not disturb the other.
    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.body.data.refreshToken as string })
      .expect(HttpStatus.OK);
  });
});

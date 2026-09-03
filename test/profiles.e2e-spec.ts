import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Profiles (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('profiles_http');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Profiles HTTP e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const username = `profile_${role}_${fixtureId}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `profile-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return { token: response.body.data.token as string, username };
  }

  function expectProfile(
    response: request.Response,
    username: string,
    following: boolean,
  ) {
    expect(response.body).toMatchObject({
      statusCode: HttpStatus.OK,
      data: { username, bio: null, following },
    });
    expect(response.body.data).toHaveProperty('image');
  }

  it('returns a public profile for anonymous and invalid optional JWT requests', async () => {
    const target = await register('public');

    const anonymous = await request(httpServer())
      .get(`/v1/profiles/${target.username}`)
      .expect(HttpStatus.OK);
    expectProfile(anonymous, target.username, false);

    const invalidJwt = await request(httpServer())
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', 'Bearer invalid-token')
      .expect(HttpStatus.OK);
    expectProfile(invalidJwt, target.username, false);
  });

  it('follows and unfollows idempotently while authenticated GET reflects the relation', async () => {
    const target = await register('target');
    const viewer = await register('viewer');
    const authorization = `Bearer ${viewer.token}`;

    const beforeFollow = await request(httpServer())
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', authorization)
      .expect(HttpStatus.OK);
    expectProfile(beforeFollow, target.username, false);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const followed = await request(httpServer())
        .post(`/v1/profiles/${target.username}/follow`)
        .set('Authorization', authorization)
        .expect(HttpStatus.OK);
      expectProfile(followed, target.username, true);
    }

    const afterFollow = await request(httpServer())
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', authorization)
      .expect(HttpStatus.OK);
    expectProfile(afterFollow, target.username, true);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const unfollowed = await request(httpServer())
        .delete(`/v1/profiles/${target.username}/follow`)
        .set('Authorization', authorization)
        .expect(HttpStatus.OK);
      expectProfile(unfollowed, target.username, false);
    }
  });

  it('requires authentication for follow and unfollow', async () => {
    const target = await register('protected');

    await request(httpServer())
      .post(`/v1/profiles/${target.username}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
    await request(httpServer())
      .delete(`/v1/profiles/${target.username}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rejects self-follow and returns not found for an absent profile', async () => {
    const viewer = await register('errors');
    const authorization = `Bearer ${viewer.token}`;

    await request(httpServer())
      .post(`/v1/profiles/${viewer.username}/follow`)
      .set('Authorization', authorization)
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await request(httpServer())
      .get(`/v1/profiles/missing-${suiteNonce}`)
      .expect(HttpStatus.NOT_FOUND);
  });
});

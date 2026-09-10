import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { useE2eSuite } from './support/e2e-suite';

describe('Profiles (e2e)', () => {
  const e2e = useE2eSuite('profiles');
  let fixtureNumber = 0;

  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = String(fixtureNumber);
    const username = `profile_${role}_${fixtureId}`;
    const response = await e2e.request
      .post('/v1/auth/register')
      .send({
        email: `profile-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return { token: response.body.data.accessToken as string, username };
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

    const anonymous = await e2e.request
      .get(`/v1/profiles/${target.username}`)
      .expect(HttpStatus.OK);
    expectProfile(anonymous, target.username, false);

    const invalidJwt = await e2e.request
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', 'Bearer invalid-token')
      .expect(HttpStatus.OK);
    expectProfile(invalidJwt, target.username, false);
  });

  it('follows and unfollows idempotently while authenticated GET reflects the relation', async () => {
    const target = await register('target');
    const viewer = await register('viewer');
    const authorization = `Bearer ${viewer.token}`;

    const beforeFollow = await e2e.request
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', authorization)
      .expect(HttpStatus.OK);
    expectProfile(beforeFollow, target.username, false);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const followed = await e2e.request
        .post(`/v1/profiles/${target.username}/follow`)
        .set('Authorization', authorization)
        .expect(HttpStatus.OK);
      expectProfile(followed, target.username, true);
    }

    const afterFollow = await e2e.request
      .get(`/v1/profiles/${target.username}`)
      .set('Authorization', authorization)
      .expect(HttpStatus.OK);
    expectProfile(afterFollow, target.username, true);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const unfollowed = await e2e.request
        .delete(`/v1/profiles/${target.username}/follow`)
        .set('Authorization', authorization)
        .expect(HttpStatus.OK);
      expectProfile(unfollowed, target.username, false);
    }
  });

  it('requires authentication for follow and unfollow', async () => {
    const target = await register('protected');

    await e2e.request
      .post(`/v1/profiles/${target.username}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
    await e2e.request
      .delete(`/v1/profiles/${target.username}/follow`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rejects self-follow and returns not found for an absent profile', async () => {
    const viewer = await register('errors');
    const authorization = `Bearer ${viewer.token}`;

    await e2e.request
      .post(`/v1/profiles/${viewer.username}/follow`)
      .set('Authorization', authorization)
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await e2e.request
      .get('/v1/profiles/missing-user')
      .expect(HttpStatus.NOT_FOUND);
  });
});

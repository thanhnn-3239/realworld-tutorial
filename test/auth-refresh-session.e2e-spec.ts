import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

describe('Auth refresh sessions (e2e)', () => {
  const e2e = useE2eSuite('auth-refresh-session');

  async function register(role: string) {
    const response = await e2e.request
      .post('/v1/auth/register')
      .send({
        email: `tok-${role}@example.com`,
        username: `tok_${role}`,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return response.body.data.refreshToken as string;
  }

  it('rotates the refresh token and refuses the spent one', async () => {
    const refreshToken = await register('rot');

    const rotated = await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.OK);

    const next = rotated.body.data.refreshToken as string;
    expect(next).not.toBe(refreshToken);

    await e2e.request
      .get('/v1/user')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken as string}`)
      .expect(HttpStatus.OK);

    await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('kills every session when a spent refresh token is replayed', async () => {
    const refreshToken = await register('replay');

    const rotated = await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.OK);
    const live = rotated.body.data.refreshToken as string;

    await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);

    await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken: live })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('revokes a single token on logout', async () => {
    const refreshToken = await register('out');

    await e2e.request
      .post('/v1/auth/logout')
      .send({ refreshToken })
      .expect(HttpStatus.NO_CONTENT);

    await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('treats logging out an unknown token as already done', async () => {
    await e2e.request
      .post('/v1/auth/logout')
      .send({ refreshToken: 'never-issued' })
      .expect(HttpStatus.NO_CONTENT);
  });

  it('rejects a missing refresh token with a validation error', async () => {
    const response = await e2e.request
      .post('/v1/auth/refresh')
      .send({})
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);

    expect(response.body.errors).toHaveProperty('refreshToken');
  });
});

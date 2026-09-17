import { HttpStatus } from '@nestjs/common';

import { useE2eSuite } from './support/e2e-suite';

describe('Auth issuance and login (e2e)', () => {
  const e2e = useE2eSuite('auth-issuance-login');
  let fixtureNumber = 0;

  beforeEach(() => {
    fixtureNumber = 0;
  });

  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = fixtureNumber;
    const response = await e2e.request
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

    await e2e.request
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

    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('treats an email as the same account regardless of case', async () => {
    const typed = 'Tok-Case-1@Example.COM';

    const registered = await e2e.request
      .post('/v1/auth/register')
      .send({
        email: typed,
        username: 'tok_case_1',
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    expect(registered.body.data.email).toBe(typed.toLowerCase());

    await e2e.request
      .post('/v1/auth/login')
      .send({ email: typed.toLowerCase(), password: 'password123' })
      .expect(HttpStatus.OK);

    await e2e.request
      .post('/v1/auth/login')
      .send({ email: typed.toUpperCase(), password: 'password123' })
      .expect(HttpStatus.OK);

    await e2e.request
      .post('/v1/auth/register')
      .send({
        email: typed.toUpperCase(),
        username: 'tok_dup_1',
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CONFLICT);
  });

  it('logging in twice leaves both sessions usable', async () => {
    const { email } = await register('multi');

    const second = await e2e.request
      .post('/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(HttpStatus.OK);

    await e2e.request
      .post('/v1/auth/refresh')
      .send({ refreshToken: second.body.data.refreshToken as string })
      .expect(HttpStatus.OK);
  });
});

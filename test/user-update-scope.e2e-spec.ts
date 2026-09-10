import { HttpStatus } from '@nestjs/common';
import { useE2eSuite } from './support/e2e-suite';

describe('User update scope (e2e)', () => {
  const e2e = useE2eSuite('user-update-scope');
  const email = 'scope@example.com';
  const password = 'password123';
  let token: string;

  beforeEach(async () => {
    const user = await e2e.fixtures.authenticatedUser({
      email,
      username: 'scope_user',
      password,
    });
    token = user.accessToken;
  });

  it('updates the profile fields it still accepts', async () => {
    const response = await e2e.request
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'I write plans' })
      .expect(HttpStatus.OK);

    expect(response.body.data.bio).toBe('I write plans');
    // Avatars are set by upload only, so an update carrying no `image` key
    // must leave the avatar exactly as it was.
    expect(response.body.data.image).toBeNull();
  });

  it('silently ignores an email change and leaves the address intact', async () => {
    const response = await e2e.request
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'hijack@example.com' })
      .expect(HttpStatus.OK);

    expect(response.body.data.email).toBe(email);
  });

  it('silently ignores a password change, leaving the original password working', async () => {
    await e2e.request
      .put('/v1/user')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'a-different-password' })
      .expect(HttpStatus.OK);

    await e2e.request
      .post('/v1/auth/login')
      .send({ email, password: 'a-different-password' })
      .expect(HttpStatus.UNAUTHORIZED);

    await e2e.request
      .post('/v1/auth/login')
      .send({ email, password })
      .expect(HttpStatus.OK);
  });
});

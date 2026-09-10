import { HttpStatus } from '@nestjs/common';
import { readGoogleAuthConfig } from '../src/auth/providers/google/google-auth.config';
import { useE2eSuite } from './support/e2e-suite';

/**
 * Asserts the branch matching the ambient environment, so the suite is correct whether or not
 * the developer has Google credentials configured. CI has none, which exercises the 404 path;
 * running with the three variables set exercises the redirect path.
 */
describe('Google routes (e2e)', () => {
  const e2e = useE2eSuite('google-routes');
  const configured = readGoogleAuthConfig() !== null;

  it('boots regardless of whether Google is configured', () => {
    expect(e2e.request).toBeDefined();
  });

  if (configured) {
    it('redirects to Google when credentials are present', async () => {
      const response = await e2e.request
        .get('/v1/auth/google')
        .expect(HttpStatus.FOUND);

      expect(response.headers.location).toContain('accounts.google.com');
    });

    it('sends the parameters Google needs, with the registered redirect_uri', async () => {
      const response = await e2e.request
        .get('/v1/auth/google')
        .expect(HttpStatus.FOUND);

      const params = new URL(response.headers.location).searchParams;

      expect(params.get('response_type')).toBe('code');
      expect(params.get('scope')).toBe('email profile');
      // Must match an Authorized redirect URI in the Google console character for character.
      expect(params.get('redirect_uri')).toBe(
        readGoogleAuthConfig()?.callbackURL,
      );
    });

    it('answers 401, not 500, when the authorization code cannot be exchanged', async () => {
      // A user pressing back, a stale bookmark or a tampered URL all land here. Before the
      // dedicated guard, passport's TokenError reached the generic handler and became a 500
      // logged as a system fault.
      const response = await e2e.request
        .get('/v1/auth/google/callback')
        .query({ code: 'malformed-probe' })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body.message).toBe(
        'Google sign-in could not be completed',
      );
    });
  } else {
    it.each(['/v1/auth/google', '/v1/auth/google/callback'])(
      'answers 404 for %s when credentials are absent',
      async (path) => {
        await e2e.request.get(path).expect(HttpStatus.NOT_FOUND);
      },
    );

    it('leaves every other auth route working', async () => {
      await e2e.request
        .post('/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  }
});

import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';
import { readGoogleAuthConfig } from '../src/auth/providers/google/google-auth.config';

const HOOK_TIMEOUT_MS = 60_000;

/**
 * Asserts the branch matching the ambient environment, so the suite is correct whether or not
 * the developer has Google credentials configured. CI has none, which exercises the 404 path;
 * running with the three variables set exercises the redirect path.
 */
describe('Google routes (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  const configured = readGoogleAuthConfig() !== null;

  beforeAll(async () => {
    db = await createTestDatabase('googleroutes');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Google routes e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  it('boots regardless of whether Google is configured', () => {
    expect(app).toBeDefined();
  });

  if (configured) {
    it('redirects to Google when credentials are present', async () => {
      const response = await request(httpServer())
        .get('/v1/auth/google')
        .expect(HttpStatus.FOUND);

      expect(response.headers.location).toContain('accounts.google.com');
    });

    it('sends the parameters Google needs, with the registered redirect_uri', async () => {
      const response = await request(httpServer())
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
      const response = await request(httpServer())
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
        await request(httpServer()).get(path).expect(HttpStatus.NOT_FOUND);
      },
    );

    it('leaves every other auth route working', async () => {
      await request(httpServer())
        .post('/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  }
});

import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';
import { AccountResolverService } from '../src/auth/account/account-resolver.service';
import { VerifiedIdentity } from '../src/auth/providers/verified-identity.interface';

const HOOK_TIMEOUT_MS = 60_000;

/**
 * Exercises the whole linking path against a real database with no Google and no HTTP
 * mocking: the `VerifiedIdentity` seam means a synthetic identity is indistinguishable from
 * one a provider produced.
 */
describe('Account linking (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let resolver: AccountResolverService;
  let fixtureNumber = 0;
  const suiteNonce = Date.now().toString(36).slice(-4);

  beforeAll(async () => {
    db = await createTestDatabase('linking');
    app = await createTestApp(db);
    resolver = app.get(AccountResolverService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Account linking e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  function identityFor(
    email: string,
    overrides: Partial<VerifiedIdentity> = {},
  ): VerifiedIdentity {
    fixtureNumber += 1;
    return {
      provider: 'google',
      providerAccountId: `sub-${suiteNonce}-${fixtureNumber}`,
      email,
      emailVerified: true,
      ...overrides,
    };
  }

  async function registerLocal(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const email = `lnk-${role}-${fixtureId}@example.com`;
    const password = 'password123';
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email,
        username: `lnk_${role}_${fixtureId}`,
        password,
        password_confirmation: password,
      })
      .expect(HttpStatus.CREATED);

    return {
      email,
      password,
      refreshToken: response.body.data.refreshToken as string,
    };
  }

  it('creates a passwordless account with a username derived from the email', async () => {
    const identity = identityFor(`lnk-new-${suiteNonce}@example.com`);

    const account = await resolver.resolve(identity);

    expect(account.email).toBe(identity.email);
    expect(account.username).toMatch(/^[a-z0-9._-]{3,30}$/);

    // Passwordless means local login is impossible, whatever password is guessed.
    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: identity.email, password: 'password123' })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns the same account on a second sign-in, without creating another', async () => {
    const identity = identityFor(`lnk-repeat-${suiteNonce}@example.com`);

    const first = await resolver.resolve(identity);
    const second = await resolver.resolve(identity);

    expect(second.id).toBe(first.id);
    expect(second.username).toBe(first.username);
  });

  it('derives a distinct username when the derived one is taken', async () => {
    const shared = `lnk-dup-${suiteNonce}`;
    const first = await resolver.resolve(identityFor(`${shared}@example.com`));
    const second = await resolver.resolve(
      identityFor(`${shared}@other.example.com`),
    );

    expect(second.username).not.toBe(first.username);
    expect(second.username.startsWith(first.username.slice(0, 5))).toBe(true);
  });

  it('links to an existing local account, clearing its password and sessions', async () => {
    const local = await registerLocal('take');

    const account = await resolver.resolve(identityFor(local.email));

    expect(account.email).toBe(local.email);

    // The password that worked a moment ago no longer does.
    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: local.email, password: local.password })
      .expect(HttpStatus.UNAUTHORIZED);

    // And the session it had is gone.
    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: local.refreshToken })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('refuses to link an unverified provider email and leaves the account untouched', async () => {
    const local = await registerLocal('unver');

    await expect(
      resolver.resolve(identityFor(local.email, { emailVerified: false })),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });

    // Nothing was cleared: the original password still works, and so does its session.
    await request(httpServer())
      .post('/v1/auth/login')
      .send({ email: local.email, password: local.password })
      .expect(HttpStatus.OK);

    await request(httpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: local.refreshToken })
      .expect(HttpStatus.OK);
  });

  it('links a second provider account to the same user without a second row in User', async () => {
    const local = await registerLocal('twice');

    const first = await resolver.resolve(identityFor(local.email));
    // A different provider subject for the same verified address — e.g. re-consented.
    const second = await resolver.resolve(identityFor(local.email));

    expect(second.id).toBe(first.id);
  });
});

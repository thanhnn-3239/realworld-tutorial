import { HttpStatus } from '@nestjs/common';
import { PendingProviderLinkRepository } from '../../src/auth/account-linking/pending-provider-link.repository';
import type { MailpitClient } from './mailpit-client';
import type { E2eContext } from './e2e-suite';
import {
  confirmationToken,
  googleCallback,
  googleIdentity,
  insertPendingToken,
  validRawToken,
} from './google-account-link-test-helpers';

async function issuedToken(
  e2e: E2eContext,
  mailpit: MailpitClient,
  role: string,
): Promise<string> {
  const identity = googleIdentity(role);
  await e2e.fixtures.user({ email: identity.email });
  await googleCallback(e2e, identity).expect(HttpStatus.ACCEPTED);
  return confirmationToken((await mailpit.waitForEmail(identity.email)).text);
}

export function registerGoogleAccountLinkEdgeScenarios(
  e2e: E2eContext,
  mailpit: MailpitClient,
): void {
  it('separates malformed confirmation input from generic invalid tokens', async () => {
    await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({})
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: 'short' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);

    const unknown = await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: validRawToken('u') })
      .expect(HttpStatus.BAD_REQUEST);
    const expiredIdentity = googleIdentity('expired');
    const expiredUser = await e2e.fixtures.user({
      email: expiredIdentity.email,
    });
    const expiredToken = validRawToken('e');
    await insertPendingToken(e2e, {
      userId: expiredUser.id,
      providerAccountId: expiredIdentity.providerAccountId,
      rawToken: expiredToken,
      expiresAt: new Date(Date.now() - 1_000),
    });
    const expired = await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: expiredToken })
      .expect(HttpStatus.BAD_REQUEST);

    const reusableToken = await issuedToken(e2e, mailpit, 'reused');
    await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: reusableToken })
      .expect(HttpStatus.OK);
    const reused = await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: reusableToken })
      .expect(HttpStatus.BAD_REQUEST);

    expect(expired.body.message).toBe(unknown.body.message);
    expect(reused.body.message).toBe(unknown.body.message);
  });

  it('treats concurrent confirmation of the same link as idempotent', async () => {
    const token = await issuedToken(e2e, mailpit, 'concurrent');
    const pendingRepo = e2e.resolve<PendingProviderLinkRepository>(
      PendingProviderLinkRepository,
    );
    const originalFindValid = pendingRepo.findValid.bind(pendingRepo);
    let reads = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      release = resolve;
    });

    jest.spyOn(pendingRepo, 'findValid').mockImplementation(async (...args) => {
      const result = await originalFindValid(...args);
      reads += 1;
      if (reads === 2) {
        release();
      } else if (reads < 2) {
        await bothRead;
      }
      return result;
    });

    try {
      const responses = await Promise.all([
        e2e.request.post('/v1/auth/google/link/confirm').send({ token }),
        e2e.request.post('/v1/auth/google/link/confirm').send({ token }),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([
        HttpStatus.OK,
        HttpStatus.OK,
      ]);
      expect(await e2e.prisma.authProvider.count()).toBe(1);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('does not move a provider account already attached elsewhere', async () => {
    const identity = googleIdentity('conflict');
    const owner = await e2e.fixtures.user();
    const target = await e2e.fixtures.user({ email: identity.email });
    await e2e.prisma.authProvider.create({
      data: {
        userId: owner.id,
        provider: 'google',
        providerAccountId: identity.providerAccountId,
      },
    });
    const rawToken = validRawToken('c');
    await insertPendingToken(e2e, {
      userId: target.id,
      providerAccountId: identity.providerAccountId,
      rawToken,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token: rawToken })
      .expect(HttpStatus.CONFLICT);

    const provider = await e2e.prisma.authProvider.findFirstOrThrow();
    expect(provider.userId).toBe(owner.id);
  });
}

export function registerEnqueueFailureScenario(e2e: E2eContext): void {
  it('returns 503 and compensates the pending row', async () => {
    const identity = googleIdentity('queue-failure');
    await e2e.fixtures.user({ email: identity.email });

    await googleCallback(e2e, identity).expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(await e2e.prisma.pendingAuthProviderLink.count()).toBe(0);
    expect(await e2e.prisma.authProvider.count()).toBe(0);
  });
}

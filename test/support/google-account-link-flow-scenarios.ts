import { HttpStatus } from '@nestjs/common';
import type { MailpitClient } from './mailpit-client';
import type { E2eContext } from './e2e-suite';
import {
  confirmationToken,
  expectTokens,
  googleCallback,
  googleIdentity,
  mailpitMessageCount,
} from './google-account-link-test-helpers';

export function registerGoogleAccountLinkFlowScenarios(
  e2e: E2eContext,
  mailpit: MailpitClient,
  mailpitApiUrl: string,
): void {
  it('logs in an account whose Google provider is already attached', async () => {
    const identity = googleIdentity('existing');
    const user = await e2e.fixtures.user({ email: identity.email });
    await e2e.prisma.authProvider.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerAccountId: identity.providerAccountId,
      },
    });

    const response = await googleCallback(e2e, identity).expect(HttpStatus.OK);

    expect(response.body.data.email).toBe(identity.email);
    expectTokens(response.body.data);
  });

  it('creates and logs in a new passwordless Google account', async () => {
    const identity = googleIdentity('new');

    const response = await googleCallback(e2e, identity).expect(HttpStatus.OK);

    expectTokens(response.body.data);
    const user = await e2e.prisma.user.findUniqueOrThrow({
      where: { email: identity.email },
      include: { authProviders: true },
    });
    expect(user.password).toBeNull();
    expect(user.authProviders).toEqual([
      expect.objectContaining({
        provider: 'google',
        providerAccountId: identity.providerAccountId,
      }),
    ]);
  });

  it('confirms a collision without changing password or existing sessions', async () => {
    const identity = googleIdentity('collision');
    const user = await e2e.fixtures.authenticatedUser({
      email: identity.email,
    });
    const originalPasswordHash = user.password;
    const originalRefreshCount = await e2e.prisma.refreshToken.count({
      where: { userId: user.id },
    });

    const collision = await googleCallback(e2e, identity).expect(
      HttpStatus.ACCEPTED,
    );
    expect(collision.body.data).toEqual({ status: 'confirmation_required' });
    expect(collision.body.data).not.toHaveProperty('accessToken');
    expect(await e2e.prisma.authProvider.count()).toBe(0);
    expect(
      (await e2e.prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
        .password,
    ).toBe(originalPasswordHash);
    expect(
      await e2e.prisma.refreshToken.count({ where: { userId: user.id } }),
    ).toBe(originalRefreshCount);

    const email = await mailpit.waitForEmail(identity.email, 15_000);
    const token = confirmationToken(email.text);
    const confirmed = await e2e.request
      .post('/v1/auth/google/link/confirm')
      .send({ token })
      .expect(HttpStatus.OK);
    expect(confirmed.body.data).toEqual({ confirmed: true });
    expect(confirmed.body.data).not.toHaveProperty('accessToken');

    const login = await googleCallback(e2e, identity).expect(HttpStatus.OK);
    expectTokens(login.body.data);
  });

  it('does not send another message during the resend cooldown', async () => {
    const identity = googleIdentity('cooldown');
    await e2e.fixtures.user({ email: identity.email });

    await googleCallback(e2e, identity).expect(HttpStatus.ACCEPTED);
    await mailpit.waitForEmail(identity.email, 15_000);
    await googleCallback(e2e, identity).expect(HttpStatus.ACCEPTED);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await mailpitMessageCount(mailpitApiUrl, identity.email)).toBe(1);
    expect(await e2e.prisma.pendingAuthProviderLink.count()).toBe(1);
  });
}

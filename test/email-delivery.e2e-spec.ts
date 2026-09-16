import { EmailQueueProducer } from '../src/email/email-queue.producer';
import { readE2eBaseConfig } from './support/e2e-config';
import { useE2eSuite } from './support/e2e-suite';
import { MailpitClient } from './support/mailpit-client';

describe('Email Delivery (e2e)', () => {
  const e2e = useE2eSuite('email-delivery');
  const baseConfig = readE2eBaseConfig();
  const mailpit = new MailpitClient(baseConfig.mailpitApiUrl);
  it('delivers confirmation email through Redis queue and SMTP to Mailpit', async () => {
    const producer = e2e.resolve<EmailQueueProducer>(EmailQueueProducer);
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recipient = `link-confirm-${uniqueId}@example.test`;
    const rawToken = `token-${uniqueId}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await producer.enqueueProviderLinkConfirmation({
      job: {
        pendingId: 999,
        recipient,
        rawToken,
        expiresAt,
      },
      tokenHashPrefix: uniqueId.slice(0, 8),
    });

    const email = await mailpit.waitForEmail(recipient, 15_000);

    const expectedUrl = new URL(baseConfig.googleLinkConfirmUrl);
    expectedUrl.searchParams.set('token', rawToken);
    const expectedUrlString = expectedUrl.toString();

    expect(email.text).toContain(expectedUrlString);
    expect(email.html).toContain(expectedUrlString);
    expect(email.text).toContain('15 minutes');
    expect(email.html).toContain('15 minutes');
  });
});

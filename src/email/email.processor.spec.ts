import { Job } from 'bullmq';
import { CustomLoggerService } from '../logger/logger.service';
import { EmailProcessor } from './email.processor';
import { ProviderLinkEmailTemplateService } from './provider-link-email-template.service';
import { MailSender } from './interfaces/send-mail-options.interface';
import { ProviderLinkConfirmationJob } from './interfaces/provider-link-confirmation-job.interface';
import { AUTH_PROVIDER_LINK_CONFIRMATION_JOB } from './constants/email-queue.constants';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let mockTemplateService: { render: jest.Mock };
  let mockMailSender: { send: jest.Mock };
  let mockLogger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    setContext: jest.Mock;
  };

  const recipient = 'user@example.com';
  const rawToken = 'super-secret-token-xyz';
  const confirmUrl =
    'http://frontend.test/auth/google/link/confirm?token=' + rawToken;

  beforeEach(() => {
    mockTemplateService = {
      render: jest.fn().mockReturnValue({
        subject: 'Confirm your Google account link',
        text: 'Confirm within 15 minutes: ' + confirmUrl,
        html: `<p>Confirm: <a href="${confirmUrl}">link</a></p>`,
      }),
    };
    mockMailSender = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    processor = new EmailProcessor(
      mockTemplateService as unknown as ProviderLinkEmailTemplateService,
      mockMailSender as unknown as MailSender,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  function createJob(
    name: string,
    data: ProviderLinkConfirmationJob,
    id = 'google-link-10-abc',
  ): Job<ProviderLinkConfirmationJob> {
    return {
      id,
      name,
      data,
      attemptsMade: 0,
    } as unknown as Job<ProviderLinkConfirmationJob>;
  }

  it('processes unexpired confirmation job by rendering and sending email', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const job = createJob(AUTH_PROVIDER_LINK_CONFIRMATION_JOB, {
      pendingId: 10,
      recipient,
      rawToken,
      expiresAt: futureDate,
    });

    await processor.process(job);

    expect(mockTemplateService.render).toHaveBeenCalledWith(rawToken);
    expect(mockMailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient,
        subject: 'Confirm your Google account link',
        jobId: job.id,
      }),
    );
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining(job.id!),
    );
  });

  it('skips expired confirmation job without sending email', async () => {
    const pastDate = new Date(Date.now() - 60 * 1000).toISOString();
    const job = createJob(AUTH_PROVIDER_LINK_CONFIRMATION_JOB, {
      pendingId: 10,
      recipient,
      rawToken,
      expiresAt: pastDate,
    });

    await processor.process(job);

    expect(mockTemplateService.render).not.toHaveBeenCalled();
    expect(mockMailSender.send).not.toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('expired'),
    );
  });

  it('throws error for unknown job name', async () => {
    const job = createJob('unrecognized-job', {
      pendingId: 10,
      recipient,
      rawToken,
      expiresAt: new Date().toISOString(),
    });

    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job name: unrecognized-job',
    );
  });

  it('logs sanitized error and rethrows when mail sender throws', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const job = createJob(AUTH_PROVIDER_LINK_CONFIRMATION_JOB, {
      pendingId: 10,
      recipient,
      rawToken,
      expiresAt: futureDate,
    });

    const forbidden = [
      recipient,
      rawToken,
      confirmUrl,
      'smtp-login',
      'smtp-password',
      'private text payload',
      '<p>private HTML payload</p>',
    ];
    const smtpError = new Error(forbidden.join(' '));
    mockMailSender.send.mockRejectedValue(smtpError);

    await expect(processor.process(job)).rejects.toBe(smtpError);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(job.id!),
    );

    const loggedErrors = JSON.stringify([
      ...mockLogger.log.mock.calls,
      ...mockLogger.error.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.debug.mock.calls,
    ]);
    for (const value of forbidden) expect(loggedErrors).not.toContain(value);
  });
});

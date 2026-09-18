import { Job } from 'bullmq';
import { ProviderLinkConfirmationJob } from '../interfaces/provider-link-confirmation-job.interface';
import { MailSender } from '../interfaces/send-mail-options.interface';
import { ProviderLinkEmailTemplateService } from '../provider-link-email-template.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { ProviderLinkConfirmationHandler } from './provider-link-confirmation.handler';
import { AUTH_PROVIDER_LINK_CONFIRMATION_JOB } from '../constants/email-queue.constants';
import { EmailJobRegistry } from '../email-job.registry';

describe('ProviderLinkConfirmationHandler', () => {
  let handler: ProviderLinkConfirmationHandler;
  const mockRegistry = {
    register: jest.fn(),
    get: jest.fn(),
  };
  const mockTemplateService = {
    render: jest.fn().mockReturnValue({
      subject: 'Confirm your Google account link',
      text: 'Confirm within 15 minutes: http://frontend.test/token',
      html: '<p>Confirm link</p>',
    }),
  };
  const mockMailSender = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    setContext: jest.fn(),
  };

  const recipient = 'user@example.com';
  const rawToken = 'super-secret-token-xyz';

  function createJob(
    name: string,
    data: ProviderLinkConfirmationJob,
    id = 'job-10',
  ): Job<ProviderLinkConfirmationJob, void, string> {
    return {
      id,
      name,
      data,
      attemptsMade: 0,
      opts: { attempts: 1 },
    } as unknown as Job<ProviderLinkConfirmationJob, void, string>;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ProviderLinkConfirmationHandler(
      mockRegistry as unknown as EmailJobRegistry,
      mockTemplateService as unknown as ProviderLinkEmailTemplateService,
      mockMailSender as unknown as MailSender,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  it('has correct jobName and registers into EmailJobRegistry on init', () => {
    expect(handler.jobName).toBe(AUTH_PROVIDER_LINK_CONFIRMATION_JOB);
    handler.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(handler);
  });

  it('delivers email for unexpired confirmation job', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const job = createJob(AUTH_PROVIDER_LINK_CONFIRMATION_JOB, {
      pendingId: 10,
      recipient,
      rawToken,
      expiresAt: futureDate,
    });

    await handler.handle(job);

    expect(mockTemplateService.render).toHaveBeenCalledWith(rawToken);
    expect(mockMailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: recipient,
        subject: 'Confirm your Google account link',
        jobId: job.id,
      }),
    );
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('job-10'),
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

    await handler.handle(job);

    expect(mockTemplateService.render).not.toHaveBeenCalled();
    expect(mockMailSender.send).not.toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('expired'),
    );
  });

  it('rethrows error and logs error without leaking sensitive data', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const job = createJob(
      AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
      {
        pendingId: 10,
        recipient,
        rawToken,
        expiresAt: futureDate,
      },
      'job-err',
    );
    const smtpError = new Error('SMTP connection failed');
    mockMailSender.send.mockRejectedValue(smtpError);

    await expect(handler.handle(job)).rejects.toBe(smtpError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('job-err'),
    );
  });
});

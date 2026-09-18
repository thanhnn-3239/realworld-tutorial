import { Job } from 'bullmq';
import { CustomLoggerService } from '../../logger/logger.service';
import { EmailJobRegistry } from '../email-job.registry';
import { EmailProcessor } from '../email.processor';
import { ArticleNotificationHandler } from '../handlers/article-notification.handler';
import { ProviderLinkConfirmationHandler } from '../handlers/provider-link-confirmation.handler';
import { MailSender } from '../interfaces/send-mail-options.interface';
import { ProviderLinkEmailTemplateService } from '../provider-link-email-template.service';

export function createMockJob<T>(
  name: string,
  data: T,
  id = 'job-test-123',
): Job<T> {
  return {
    id,
    name,
    data,
    attemptsMade: 0,
  } as unknown as Job<T>;
}

export function createEmailProcessorTestContext() {
  const registry = new EmailJobRegistry();

  const mockTemplateService = {
    render: jest.fn().mockReturnValue({
      subject: 'Confirm your Google account link',
      text: 'Confirm within 15 minutes: http://frontend.test/auth/google/link/confirm?token=super-secret-token-xyz',
      html: '<p>Confirm: <a href="http://frontend.test/auth/google/link/confirm?token=super-secret-token-xyz">link</a></p>',
    }),
  };

  const mockMailSender = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
  };

  const linkHandler = new ProviderLinkConfirmationHandler(
    registry,
    mockTemplateService as unknown as ProviderLinkEmailTemplateService,
    mockMailSender as unknown as MailSender,
    mockLogger as unknown as CustomLoggerService,
  );
  linkHandler.onModuleInit();

  const notificationHandler = new ArticleNotificationHandler(
    registry,
    mockMailSender as unknown as MailSender,
    mockLogger as unknown as CustomLoggerService,
  );
  notificationHandler.onModuleInit();

  const processor = new EmailProcessor(
    registry,
    mockLogger as unknown as CustomLoggerService,
  );

  return {
    processor,
    registry,
    linkHandler,
    notificationHandler,
    mockTemplateService,
    mockMailSender,
    mockLogger,
  };
}

import { ArticleNotificationJob } from '../interfaces/article-notification-job.interface';
import { MailSender } from '../interfaces/send-mail-options.interface';
import { CustomLoggerService } from '../../logger/logger.service';
import { ArticleNotificationHandler } from './article-notification.handler';
import { createMockJob } from '../testing/email-processor-test-context';
import { ARTICLE_NOTIFICATION_JOB } from '../constants/email-queue.constants';
import { EmailJobRegistry } from '../email-job.registry';

describe('ArticleNotificationHandler', () => {
  let handler: ArticleNotificationHandler;
  const mockRegistry = {
    register: jest.fn(),
    get: jest.fn(),
  };
  const mockMailSender = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    setContext: jest.fn(),
  };

  const notificationData: ArticleNotificationJob = {
    to: 'author@example.com',
    recipientUsername: 'author1',
    subject: 'user2 vừa thích bài viết của bạn',
    body: 'Xin chào author1, user2 vừa thích bài viết của bạn.',
    eventType: 'ARTICLE_FAVORITED',
    articleId: 42,
    recipientId: 99,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ArticleNotificationHandler(
      mockRegistry as unknown as EmailJobRegistry,
      mockMailSender as unknown as MailSender,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  it('has correct jobName and registers into EmailJobRegistry on init', () => {
    expect(handler.jobName).toBe(ARTICLE_NOTIFICATION_JOB);
    handler.onModuleInit();
    expect(mockRegistry.register).toHaveBeenCalledWith(handler);
  });

  it('delivers plain text email for article notification', async () => {
    const job = createMockJob<ArticleNotificationJob>(
      ARTICLE_NOTIFICATION_JOB,
      notificationData,
      'job-notify-1',
    );

    await handler.handle(job);

    expect(mockMailSender.send).toHaveBeenCalledWith({
      to: notificationData.to,
      subject: notificationData.subject,
      text: notificationData.body,
      jobId: job.id,
    });
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('job-notify-1'),
    );
  });

  it('rethrows error and logs error without leaking sensitive data', async () => {
    const job = createMockJob<ArticleNotificationJob>(
      ARTICLE_NOTIFICATION_JOB,
      notificationData,
      'job-err',
    );
    const smtpError = new Error('SMTP connection failure');
    mockMailSender.send.mockRejectedValue(smtpError);

    await expect(handler.handle(job)).rejects.toBe(smtpError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('job-err'),
    );
  });
});

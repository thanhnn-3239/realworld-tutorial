import { Queue } from 'bullmq';
import { CustomLoggerService } from '../logger/logger.service';
import { EmailQueueProducer } from './email-queue.producer';
import { EnqueueProviderLinkEmail } from './interfaces/enqueue-provider-link-email.interface';
import { ArticleNotificationJob } from './interfaces/article-notification-job.interface';
import {
  ARTICLE_NOTIFICATION_JOB,
  ARTICLE_NOTIFICATION_JOB_ID_PREFIX,
  AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
  EMAIL_JOB_ID_PREFIX,
  EMAIL_QUEUE_ATTEMPTS,
  EMAIL_QUEUE_BACKOFF_DELAY_MS,
  EMAIL_QUEUE_BACKOFF_TYPE,
  EMAIL_QUEUE_FAILED_JOB_AGE_SECS,
  EMAIL_QUEUE_FAILED_JOB_MAX_COUNT,
} from './constants/email-queue.constants';

describe('EmailQueueProducer', () => {
  let producer: EmailQueueProducer;
  let mockQueue: { add: jest.Mock };
  let mockLogger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    setContext: jest.Mock;
  };

  const recipient = 'test-user@example.com';
  const rawToken = 'super-secret-raw-token-xyz';

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    };
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    producer = new EmailQueueProducer(
      mockQueue as unknown as Queue,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  it('enqueues provider link confirmation job with required BullMQ options', async () => {
    const input: EnqueueProviderLinkEmail = {
      job: {
        pendingId: 42,
        recipient,
        rawToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      tokenHashPrefix: 'a1b2c3d4',
    };

    await producer.enqueueProviderLinkConfirmation(input);

    expect(mockQueue.add).toHaveBeenCalledWith(
      AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
      input.job,
      expect.objectContaining({
        attempts: EMAIL_QUEUE_ATTEMPTS,
        backoff: {
          type: EMAIL_QUEUE_BACKOFF_TYPE,
          delay: EMAIL_QUEUE_BACKOFF_DELAY_MS,
        },
        jobId: `${EMAIL_JOB_ID_PREFIX}42-a1b2c3d4`,
        removeOnComplete: true,
        removeOnFail: {
          age: EMAIL_QUEUE_FAILED_JOB_AGE_SECS,
          count: EMAIL_QUEUE_FAILED_JOB_MAX_COUNT,
        },
      }),
    );

    // Verify tokenHashPrefix is not part of the persisted job payload
    const persistedPayload = mockQueue.add.mock.calls[0][1];
    expect(persistedPayload).toEqual(input.job);
    expect(persistedPayload).not.toHaveProperty('tokenHashPrefix');
  });

  it('never logs rawToken, recipient, or complete job payload', async () => {
    const input: EnqueueProviderLinkEmail = {
      job: {
        pendingId: 42,
        recipient,
        rawToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      tokenHashPrefix: 'a1b2c3d4',
    };

    await producer.enqueueProviderLinkConfirmation(input);

    const allLogged = [
      ...mockLogger.log.mock.calls,
      ...mockLogger.debug.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ]
      .map((c) => c[0])
      .join(' ');

    expect(allLogged).not.toContain(rawToken);
    expect(allLogged).not.toContain(recipient);
  });

  it('propagates error when queue.add rejects', async () => {
    mockQueue.add.mockRejectedValue(new Error('Redis connection refused'));

    const input: EnqueueProviderLinkEmail = {
      job: {
        pendingId: 42,
        recipient,
        rawToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      tokenHashPrefix: 'a1b2c3d4',
    };

    await expect(
      producer.enqueueProviderLinkConfirmation(input),
    ).rejects.toThrow('Redis connection refused');
  });

  describe('enqueueArticleNotification', () => {
    const notificationJob: ArticleNotificationJob = {
      to: 'author@example.com',
      recipientUsername: 'author1',
      subject: 'user2 favorited your article',
      body: 'Hello author1, user2 just favorited your article "Hello World".',
      eventType: 'ARTICLE_FAVORITED',
      articleId: 99,
      recipientId: 7,
    };

    it('enqueues article notification job with deterministic jobId and retry options', async () => {
      await producer.enqueueArticleNotification(notificationJob);

      expect(mockQueue.add).toHaveBeenCalledWith(
        ARTICLE_NOTIFICATION_JOB,
        notificationJob,
        expect.objectContaining({
          attempts: EMAIL_QUEUE_ATTEMPTS,
          backoff: {
            type: EMAIL_QUEUE_BACKOFF_TYPE,
            delay: EMAIL_QUEUE_BACKOFF_DELAY_MS,
          },
          jobId: `${ARTICLE_NOTIFICATION_JOB_ID_PREFIX}ARTICLE_FAVORITED-99-7`,
          removeOnComplete: true,
          removeOnFail: {
            age: EMAIL_QUEUE_FAILED_JOB_AGE_SECS,
            count: EMAIL_QUEUE_FAILED_JOB_MAX_COUNT,
          },
        }),
      );
    });

    it('never logs recipient email or sensitive body content', async () => {
      await producer.enqueueArticleNotification(notificationJob);

      const allLogged = [
        ...mockLogger.log.mock.calls,
        ...mockLogger.debug.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
      ]
        .map((c) => c[0])
        .join(' ');

      expect(allLogged).not.toContain(notificationJob.to);
      expect(allLogged).not.toContain(notificationJob.body);
    });

    it('propagates error when queue.add rejects', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis connection refused'));

      await expect(
        producer.enqueueArticleNotification(notificationJob),
      ).rejects.toThrow('Redis connection refused');
    });
  });
});

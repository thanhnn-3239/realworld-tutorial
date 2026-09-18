import { Job } from 'bullmq';
import {
  ARTICLE_NOTIFICATION_JOB,
  AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
} from './constants/email-queue.constants';
import { EmailJobHandler } from './interfaces/email-job-handler.interface';
import { EmailProcessor } from './email.processor';
import { EmailJobRegistry } from './email-job.registry';
import { CustomLoggerService } from '../logger/logger.service';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let registry: EmailJobRegistry;
  const mockLinkHandler: EmailJobHandler = {
    jobName: AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
    handle: jest.fn().mockResolvedValue(undefined),
  };
  const mockNotificationHandler: EmailJobHandler = {
    jobName: ARTICLE_NOTIFICATION_JOB,
    handle: jest.fn().mockResolvedValue(undefined),
  };
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    setContext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new EmailJobRegistry();
    registry.register(mockLinkHandler);
    registry.register(mockNotificationHandler);

    processor = new EmailProcessor(
      registry,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  it('dispatches confirmation job to ProviderLinkConfirmationHandler', async () => {
    const job = { name: AUTH_PROVIDER_LINK_CONFIRMATION_JOB } as Job<
      unknown,
      void,
      string
    >;
    await processor.process(job);

    expect(mockLinkHandler.handle).toHaveBeenCalledWith(job);
    expect(mockNotificationHandler.handle).not.toHaveBeenCalled();
  });

  it('dispatches article notification job to ArticleNotificationHandler', async () => {
    const job = { name: ARTICLE_NOTIFICATION_JOB } as Job<
      unknown,
      void,
      string
    >;
    await processor.process(job);

    expect(mockNotificationHandler.handle).toHaveBeenCalledWith(job);
    expect(mockLinkHandler.handle).not.toHaveBeenCalled();
  });

  it('throws error for unregistered job name', async () => {
    const job = { name: 'unknown-job' } as Job<unknown, void, string>;
    await expect(processor.process(job)).rejects.toThrow(
      'Unknown job name: unknown-job',
    );
  });

  describe('worker events', () => {
    it('logs warning when job fails but retry attempts remain', () => {
      const job = {
        id: 'job-123',
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as unknown as Job;
      processor.onFailed(job, new Error('ETIMEDOUT'));
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed attempt 1/3, will retry'),
      );
    });

    it('logs error when all retry attempts are exhausted', () => {
      const job = {
        id: 'job-123',
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as unknown as Job;
      processor.onFailed(job, new Error('ETIMEDOUT'));
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed after 3 attempts'),
      );
    });

    it('logs error on worker error event', () => {
      processor.onError(new Error('Connection lost'));
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Email worker encountered error'),
      );
    });
  });
});

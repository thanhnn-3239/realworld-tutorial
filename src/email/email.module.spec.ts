import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Queue, Worker } from 'bullmq';
import { LoggerModule } from '../logger/logger.module';
import { CustomLoggerService } from '../logger/logger.service';
import { EmailModule } from './email.module';
import { EmailQueueProducer } from './email-queue.producer';
import { SMTP_MAIL_SENDER } from './constants/mail-sender.constants';

// Replace only the Redis boundary; Nest module factories and worker discovery run.
jest.mock('bullmq', () => ({
  ...jest.requireActual('bullmq'),
  Queue: jest.fn().mockImplementation((name, opts) => ({
    name,
    opts,
    add: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn().mockImplementation((name, processor, opts) => ({
    name,
    opts,
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EmailModule connection wiring', () => {
  it('gives the worker unlimited retries and keeps producer retries bounded', async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        LoggerModule.register(),
        EmailModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          REDIS_URL: 'redis://redis.test:6380/2',
          REDIS_PREFIX: 'email-wiring-test',
          GOOGLE_LINK_CONFIRM_URL: 'https://app.test/confirm',
        }),
      )
      .overrideProvider(CustomLoggerService)
      .useValue({ setContext: jest.fn(), log: jest.fn() })
      .overrideProvider(SMTP_MAIL_SENDER)
      .useValue({ send: jest.fn() })
      .compile();

    try {
      await module.init();
      expect(Worker).toHaveBeenCalledTimes(1);
      expect(Worker).toHaveBeenCalledWith(
        'email',
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            host: 'redis.test',
            port: 6380,
            db: 2,
            maxRetriesPerRequest: null,
          }),
          prefix: 'email-wiring-test',
        }),
      );
      expect(Queue).toHaveBeenCalledTimes(1);
      expect(Queue).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({
          connection: expect.objectContaining({
            host: 'redis.test',
            port: 6380,
            db: 2,
            maxRetriesPerRequest: 1,
          }),
          prefix: 'email-wiring-test',
        }),
      );
      await module.get(EmailQueueProducer).enqueueProviderLinkConfirmation({
        job: {
          pendingId: 10,
          recipient: 'user@example.test',
          rawToken: 'test-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        tokenHashPrefix: 'abc123',
      });
      const queue = jest.mocked(Queue).mock.results[0].value as Queue;
      expect(queue.add).toHaveBeenCalledWith(
        'auth-provider-link-confirmation',
        expect.objectContaining({ pendingId: 10 }),
        expect.objectContaining({ jobId: 'google-link-10-abc123' }),
      );
    } finally {
      await module.close();
    }
  });
});

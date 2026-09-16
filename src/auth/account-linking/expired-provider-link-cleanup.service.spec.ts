import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { CustomLoggerService } from '../../logger/logger.service';
import { ExpiredProviderLinkCleanupService } from './expired-provider-link-cleanup.service';
import { PendingProviderLinkRepository } from './pending-provider-link.repository';

describe('ExpiredProviderLinkCleanupService', () => {
  let service: ExpiredProviderLinkCleanupService;
  let repository: { deleteExpired: jest.Mock };
  let logger: { log: jest.Mock; error: jest.Mock; setContext: jest.Mock };

  beforeEach(() => {
    repository = { deleteExpired: jest.fn().mockResolvedValue(0) };
    logger = { log: jest.fn(), error: jest.fn(), setContext: jest.fn() };

    service = new ExpiredProviderLinkCleanupService(
      repository as unknown as PendingProviderLinkRepository,
      logger as unknown as CustomLoggerService,
    );
  });

  it('deletes links that expired before the sweep runs', async () => {
    const before = Date.now();

    await service.removeExpiredLinks();

    expect(repository.deleteExpired).toHaveBeenCalledTimes(1);
    const cutoff = repository.deleteExpired.mock.calls[0][0] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('logs deleted count on success', async () => {
    repository.deleteExpired.mockResolvedValue(5);

    await service.removeExpiredLinks();

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('5'),
      expect.any(String),
    );
  });

  it('swallows repository error and logs it so scheduler survives', async () => {
    repository.deleteExpired.mockRejectedValue(new Error('db down'));

    await expect(service.removeExpiredLinks()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('db down'),
      expect.any(String),
    );
    expect(logger.log).not.toHaveBeenCalled();
  });
});

describe('ExpiredProviderLinkCleanupService scheduling', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        ExpiredProviderLinkCleanupService,
        {
          provide: PendingProviderLinkRepository,
          useValue: { deleteExpired: jest.fn() },
        },
        {
          provide: CustomLoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            setContext: jest.fn(),
          },
        },
      ],
    }).compile();

    await moduleRef.init();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('registers the sweep with the scheduler', () => {
    const jobs = moduleRef.get(SchedulerRegistry).getCronJobs();

    expect(jobs.size).toBe(1);
  });

  it('schedules the sweep daily at 4am', () => {
    const [job] = [...moduleRef.get(SchedulerRegistry).getCronJobs().values()];

    expect(job.cronTime.source).toBe('0 0 4 * * *');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  CronExpression,
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';
import { CustomLoggerService } from '../../logger/logger.service';
import { ExpiredTokenCleanupService } from './expired-token-cleanup.service';
import { RefreshTokenRepository } from './refresh-token.repository';

describe('ExpiredTokenCleanupService', () => {
  let service: ExpiredTokenCleanupService;
  let repository: { deleteExpired: jest.Mock };
  let logger: { log: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    repository = { deleteExpired: jest.fn().mockResolvedValue(0) };
    logger = { log: jest.fn(), error: jest.fn() };

    service = new ExpiredTokenCleanupService(
      repository as unknown as RefreshTokenRepository,
      logger as unknown as CustomLoggerService,
    );
  });

  it('deletes tokens that expired before the moment the sweep runs', async () => {
    const before = Date.now();

    await service.removeExpiredTokens();

    expect(repository.deleteExpired).toHaveBeenCalledTimes(1);
    const cutoff = repository.deleteExpired.mock.calls[0][0] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('reports how many rows the sweep removed', async () => {
    repository.deleteExpired.mockResolvedValue(12);

    await service.removeExpiredTokens();

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('12'),
      expect.any(String),
    );
  });

  it('logs and swallows a repository failure so the schedule survives it', async () => {
    repository.deleteExpired.mockRejectedValue(new Error('connection lost'));

    await expect(service.removeExpiredTokens()).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('connection lost'),
      expect.any(String),
    );
    expect(logger.log).not.toHaveBeenCalled();
  });
});

/**
 * Boots the real ScheduleModule: a @Cron that silently fails to register would otherwise
 * pass every unit test above and never run in production.
 */
describe('ExpiredTokenCleanupService scheduling', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        ExpiredTokenCleanupService,
        {
          provide: RefreshTokenRepository,
          useValue: { deleteExpired: jest.fn() },
        },
        {
          provide: CustomLoggerService,
          useValue: { log: jest.fn(), error: jest.fn() },
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

  it('schedules the sweep daily at 3am', () => {
    const [job] = [...moduleRef.get(SchedulerRegistry).getCronJobs().values()];

    expect(job.cronTime.source).toBe(CronExpression.EVERY_DAY_AT_3AM);
  });
});

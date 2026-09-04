import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns ok after a successful database probe', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ready: 1 }]) };
    const service = new HealthService(prisma as never);

    await expect(service.check()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('masks database failures behind ServiceUnavailableException', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED postgres://secret')),
    };
    const service = new HealthService(prisma as never);

    await expect(service.check()).rejects.toThrow(
      new ServiceUnavailableException('Service unavailable'),
    );
  });
});

import type { Queue } from 'bullmq';
import { EmailQueueReadinessService } from './email-queue-readiness.service';

describe('EmailQueueReadinessService', () => {
  it('pings the producer Redis client', async () => {
    const ping = jest.fn().mockResolvedValue('PONG');
    const queue = {
      getBackend: () => ({ client: Promise.resolve({ ping }) }),
    } as unknown as Queue;
    const service = new EmailQueueReadinessService(queue);

    await expect(service.ping()).resolves.toBeUndefined();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('rejects when the producer Redis client rejects', async () => {
    const queue = {
      getBackend: () => ({
        client: Promise.resolve({
          ping: jest.fn().mockRejectedValue(new Error('connection failed')),
        }),
      }),
    } as unknown as Queue;
    const service = new EmailQueueReadinessService(queue);

    await expect(service.ping()).rejects.toThrow('connection failed');
  });

  it('bounds a Redis ping that never settles', async () => {
    jest.useFakeTimers();
    const queue = {
      getBackend: () => ({
        client: Promise.resolve({ ping: () => new Promise(() => undefined) }),
      }),
    } as unknown as Queue;
    const service = new EmailQueueReadinessService(queue);

    try {
      const result = expect(service.ping()).rejects.toThrow(
        'Email queue readiness timed out',
      );
      await jest.advanceTimersByTimeAsync(1_000);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });
});

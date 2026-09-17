import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import Piscina from 'piscina';
import { PiscinaPoolService } from './piscina-pool.service';
import { PiscinaPoolUnavailableError } from './errors/piscina-pool-unavailable.error';
import { PiscinaTaskTimeoutError } from './errors/piscina-task-timeout.error';
import type { CustomLoggerService } from '../logger/logger.service';

interface MockPool {
  options: Record<string, unknown>;
  run: jest.Mock;
  close: jest.Mock;
  on: jest.Mock;
  queueSize: number;
}

jest.mock('piscina', () => {
  const constructor = jest.fn().mockImplementation((options) => ({
    options,
    run: jest.fn().mockResolvedValue('result'),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    queueSize: 0,
  }));
  return { __esModule: true, default: constructor, Piscina: constructor };
});
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(),
}));
jest.mock('node:os', () => ({
  ...jest.requireActual('node:os'),
  availableParallelism: jest.fn(),
}));

const WORKER_PATH = '/app/dist/workers/math.worker.js';
const mockedExistsSync = existsSync as jest.Mock;
const mockedAvailableParallelism = availableParallelism as jest.Mock;
const MockedPiscina = Piscina as unknown as jest.Mock;

function latestPool(): MockPool {
  return MockedPiscina.mock.results.at(-1)?.value as MockPool;
}

function buildLogger(): jest.Mocked<Pick<CustomLoggerService, 'error'>> {
  return { error: jest.fn() };
}

describe('PiscinaPoolService', () => {
  let logger: ReturnType<typeof buildLogger>;
  let service: PiscinaPoolService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedAvailableParallelism.mockReturnValue(4);
    logger = buildLogger();
    service = new PiscinaPoolService(logger as unknown as CustomLoggerService);
  });

  afterEach(() => jest.useRealTimers());

  it.each([
    [1, 1, 2],
    [4, 2, 4],
    [9, 2, 4],
  ])('uses bounded capacity for %i CPUs', (cpus, maxThreads, maxQueue) => {
    mockedAvailableParallelism.mockReturnValue(cpus);
    new PiscinaPoolService(logger as unknown as CustomLoggerService);

    expect(MockedPiscina).toHaveBeenLastCalledWith({
      minThreads: 1,
      maxThreads,
      maxQueue,
      closeTimeout: 30_000,
      concurrentTasksPerWorker: 1,
    });
  });

  it('runs a typed task with its worker and transfer options', async () => {
    const task = { value: 21 };
    const transfer = new Uint8Array([1, 2, 3]);

    await expect(
      service.run<typeof task, string>(task, {
        workerPath: WORKER_PATH,
        workerName: 'double',
        timeoutMs: 5_000,
        transferList: [transfer.buffer],
      }),
    ).resolves.toBe('result');

    expect(latestPool().run).toHaveBeenCalledWith(task, {
      filename: WORKER_PATH,
      name: 'double',
      signal: expect.any(AbortSignal),
      transferList: [transfer.buffer],
    });
  });

  it('validates each worker path only once', async () => {
    await service.run({}, { workerPath: WORKER_PATH });
    await service.run({}, { workerPath: WORKER_PATH });

    expect(mockedExistsSync).toHaveBeenCalledTimes(1);
  });

  it('rejects an unavailable worker before dispatch', async () => {
    mockedExistsSync.mockReturnValue(false);

    await expect(
      service.run({}, { workerPath: WORKER_PATH }),
    ).rejects.toBeInstanceOf(PiscinaPoolUnavailableError);
    expect(latestPool().run).not.toHaveBeenCalled();
  });

  it('rejects new work when the queue is full', async () => {
    latestPool().queueSize = 4;

    await expect(
      service.run({}, { workerPath: WORKER_PATH }),
    ).rejects.toBeInstanceOf(PiscinaPoolUnavailableError);
    expect(latestPool().run).not.toHaveBeenCalled();
  });

  it('stops admission before pool close resolves', async () => {
    let resolveClose: () => void = () => undefined;
    latestPool().close.mockImplementation(
      () => new Promise<void>((resolve) => (resolveClose = resolve)),
    );

    const shutdown = service.onApplicationShutdown();

    await expect(
      service.run({}, { workerPath: WORKER_PATH }),
    ).rejects.toBeInstanceOf(PiscinaPoolUnavailableError);
    expect(latestPool().close).toHaveBeenCalledTimes(1);
    resolveClose();
    await shutdown;
  });

  it.each([
    ['default', undefined, 10_000],
    ['custom', 25, 25],
  ])(
    'aborts a task at its %s deadline',
    async (_label, timeoutMs, deadline) => {
      jest.useFakeTimers();
      latestPool().run.mockImplementation(
        (_task: unknown, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      );

      const pending = service.run({}, { workerPath: WORKER_PATH, timeoutMs });
      pending.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(deadline);

      await expect(pending).rejects.toBeInstanceOf(PiscinaTaskTimeoutError);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('maps worker rejection to a generic unavailable error', async () => {
    latestPool().run.mockRejectedValue(new Error('worker crashed'));

    await expect(
      service.run({}, { workerPath: WORKER_PATH }),
    ).rejects.toBeInstanceOf(PiscinaPoolUnavailableError);
  });

  it('logs uncaught pool errors without task data', () => {
    const [, handler] = latestPool().on.mock.calls[0] as [
      string,
      (error: Error) => void,
    ];
    handler(new Error('worker crashed'));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('worker crashed'),
      expect.anything(),
    );
  });
});

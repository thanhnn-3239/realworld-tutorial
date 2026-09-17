import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { availableParallelism } from 'node:os';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Piscina from 'piscina';
import { CustomLoggerService } from '../logger/logger.service';
import {
  CLOSE_TIMEOUT_MS,
  DEFAULT_TASK_TIMEOUT_MS,
  MAX_THREADS_CAP,
  MIN_THREADS,
  QUEUE_MULTIPLIER,
  TASKS_PER_WORKER,
} from './constants/piscina-pool.constants';
import { PiscinaPoolUnavailableError } from './errors/piscina-pool-unavailable.error';
import { PiscinaTaskTimeoutError } from './errors/piscina-task-timeout.error';
import type { PiscinaTaskOptions } from './interfaces/piscina-task-options.interface';

@Injectable()
export class PiscinaPoolService implements OnApplicationShutdown {
  private readonly pool: Piscina;
  private readonly maxQueue: number;
  private readonly validatedWorkerPaths = new Set<string>();
  private closing = false;

  constructor(private readonly logger: CustomLoggerService) {
    const maxThreads = Math.max(
      MIN_THREADS,
      Math.min(MAX_THREADS_CAP, availableParallelism() - 1),
    );
    this.maxQueue = maxThreads * QUEUE_MULTIPLIER;
    this.pool = new Piscina({
      minThreads: MIN_THREADS,
      maxThreads,
      maxQueue: this.maxQueue,
      closeTimeout: CLOSE_TIMEOUT_MS,
      concurrentTasksPerWorker: TASKS_PER_WORKER,
    });

    this.pool.on('error', (error: unknown) => {
      this.logger.error(
        `Piscina worker error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async run<TTask, TResult>(
    task: TTask,
    options: PiscinaTaskOptions,
  ): Promise<TResult> {
    this.assertAccepting();
    this.assertWorkerPath(options.workerPath);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS);

    try {
      return (await this.pool.run(task, {
        filename: options.workerPath,
        name: options.workerName,
        signal: controller.signal,
        transferList: options.transferList,
      })) as TResult;
    } catch (error) {
      if (timedOut) throw new PiscinaTaskTimeoutError();
      throw new PiscinaPoolUnavailableError(undefined, {
        cause: error instanceof Error ? error : undefined,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    await this.pool.close();
  }

  private assertAccepting(): void {
    if (this.closing) {
      throw new PiscinaPoolUnavailableError('Piscina pool is shutting down');
    }

    if (this.pool.queueSize >= this.maxQueue) {
      throw new PiscinaPoolUnavailableError(
        'Piscina task queue is at capacity',
      );
    }
  }

  private assertWorkerPath(workerPath: string): void {
    if (this.validatedWorkerPaths.has(workerPath)) return;
    if (!isAbsolute(workerPath) || !existsSync(workerPath)) {
      throw new PiscinaPoolUnavailableError(
        `Piscina worker not found at ${workerPath}`,
      );
    }
    this.validatedWorkerPaths.add(workerPath);
  }
}

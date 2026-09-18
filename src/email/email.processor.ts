import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CustomLoggerService } from '../logger/logger.service';
import {
  EMAIL_QUEUE_NAME,
  EMAIL_WORKER_CONFIG_KEY,
} from './constants/email-queue.constants';
import { EmailJobRegistry } from './email-job.registry';

@Processor({
  name: EMAIL_QUEUE_NAME,
  configKey: EMAIL_WORKER_CONFIG_KEY,
})
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly registry: EmailJobRegistry,
    private readonly logger: CustomLoggerService,
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
  }

  async process(job: Job<unknown, void, string>): Promise<void> {
    const handler = this.registry.get(job.name);
    if (!handler) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    return handler.handle(job);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    const maxAttempts = job.opts?.attempts ?? 1;
    const isExhausted = job.attemptsMade >= maxAttempts;
    const err = error as { name?: string; code?: string };

    if (isExhausted) {
      this.logger.error(
        `Job ${job.id ?? 'unknown'} permanently failed after ${job.attemptsMade} attempts: ${err.name || 'Error'} (${err.code || 'UNKNOWN'})`,
      );
    } else {
      this.logger.warn(
        `Job ${job.id ?? 'unknown'} failed attempt ${job.attemptsMade}/${maxAttempts}, will retry: ${err.name || 'Error'} (${err.code || 'UNKNOWN'})`,
      );
    }
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    const err = error as { name?: string; code?: string };
    this.logger.error(
      `Email worker encountered error: ${err.name || 'Error'} (${err.code || 'UNKNOWN'})`,
    );
  }
}

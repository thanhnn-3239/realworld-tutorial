import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CustomLoggerService } from '../logger/logger.service';
import { EnqueueProviderLinkEmail } from './interfaces/enqueue-provider-link-email.interface';
import {
  AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
  EMAIL_JOB_ID_PREFIX,
  EMAIL_PRODUCER_CONFIG_KEY,
  EMAIL_QUEUE_ATTEMPTS,
  EMAIL_QUEUE_BACKOFF_DELAY_MS,
  EMAIL_QUEUE_BACKOFF_TYPE,
  EMAIL_QUEUE_FAILED_JOB_AGE_SECS,
  EMAIL_QUEUE_FAILED_JOB_MAX_COUNT,
} from './constants/email-queue.constants';

@Injectable()
export class EmailQueueProducer {
  constructor(
    @InjectQueue(EMAIL_PRODUCER_CONFIG_KEY)
    private readonly emailQueue: Queue,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(EmailQueueProducer.name);
  }

  async enqueueProviderLinkConfirmation(
    input: EnqueueProviderLinkEmail,
  ): Promise<void> {
    const jobId = `${EMAIL_JOB_ID_PREFIX}${input.job.pendingId}-${input.tokenHashPrefix}`;

    await this.emailQueue.add(AUTH_PROVIDER_LINK_CONFIRMATION_JOB, input.job, {
      attempts: EMAIL_QUEUE_ATTEMPTS,
      backoff: {
        type: EMAIL_QUEUE_BACKOFF_TYPE,
        delay: EMAIL_QUEUE_BACKOFF_DELAY_MS,
      },
      jobId,
      removeOnComplete: true,
      removeOnFail: {
        age: EMAIL_QUEUE_FAILED_JOB_AGE_SECS,
        count: EMAIL_QUEUE_FAILED_JOB_MAX_COUNT,
      },
    });

    this.logger.log(
      `Enqueued provider link confirmation job: ${jobId} for pendingId: ${input.job.pendingId}`,
    );
  }
}

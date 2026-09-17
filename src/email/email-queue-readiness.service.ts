import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { EMAIL_PRODUCER_CONFIG_KEY } from './constants/email-queue.constants';

const QUEUE_PING_TIMEOUT_MS = 1_000;

interface PingableRedisClient {
  ping(): Promise<string>;
}

@Injectable()
export class EmailQueueReadinessService {
  constructor(
    @InjectQueue(EMAIL_PRODUCER_CONFIG_KEY)
    private readonly queue: Queue,
  ) {}

  async ping(): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        (async () => {
          const client = (await this.queue.getBackend()
            .client) as unknown as PingableRedisClient;
          await client.ping();
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Email queue readiness timed out')),
            QUEUE_PING_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

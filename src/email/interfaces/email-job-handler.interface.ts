import { Job } from 'bullmq';

export interface EmailJobHandler<T = unknown> {
  readonly jobName: string;
  handle(job: Job<T, void, string>): Promise<void>;
}

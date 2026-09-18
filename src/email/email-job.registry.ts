import { Injectable } from '@nestjs/common';
import { EmailJobHandler } from './interfaces/email-job-handler.interface';

@Injectable()
export class EmailJobRegistry {
  private readonly handlers = new Map<string, EmailJobHandler>();

  register(handler: EmailJobHandler): void {
    this.handlers.set(handler.jobName, handler);
  }

  get(jobName: string): EmailJobHandler | undefined {
    return this.handlers.get(jobName);
  }
}

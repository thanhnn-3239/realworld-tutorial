import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { CustomLoggerService } from '../../logger/logger.service';
import { ARTICLE_NOTIFICATION_JOB } from '../constants/email-queue.constants';
import { SMTP_MAIL_SENDER } from '../constants/mail-sender.constants';
import { EmailJobRegistry } from '../email-job.registry';
import { ArticleNotificationJob } from '../interfaces/article-notification-job.interface';
import { EmailJobHandler } from '../interfaces/email-job-handler.interface';
import type { MailSender } from '../interfaces/send-mail-options.interface';

@Injectable()
export class ArticleNotificationHandler
  implements EmailJobHandler<ArticleNotificationJob>, OnModuleInit
{
  readonly jobName = ARTICLE_NOTIFICATION_JOB;

  constructor(
    private readonly registry: EmailJobRegistry,
    @Inject(SMTP_MAIL_SENDER)
    private readonly mailSender: MailSender,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(ArticleNotificationHandler.name);
  }

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(job: Job<ArticleNotificationJob, void, string>): Promise<void> {
    const { to, subject, body } = job.data;
    try {
      await this.mailSender.send({
        to,
        subject,
        text: body,
        jobId: job.id,
      });
      this.logger.log(
        `Delivered article notification email for job ${job.id ?? 'unknown'}`,
      );
    } catch (error) {
      const err = error as { name?: string; code?: string };
      this.logger.error(
        `Failed to deliver notification email for job ${job.id ?? 'unknown'} (${err.code || err.name || 'UNKNOWN'})`,
      );
      throw error;
    }
  }
}

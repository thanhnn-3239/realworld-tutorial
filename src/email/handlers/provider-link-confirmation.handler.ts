import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { CustomLoggerService } from '../../logger/logger.service';
import { AUTH_PROVIDER_LINK_CONFIRMATION_JOB } from '../constants/email-queue.constants';
import { SMTP_MAIL_SENDER } from '../constants/mail-sender.constants';
import { EmailJobRegistry } from '../email-job.registry';
import { EmailJobHandler } from '../interfaces/email-job-handler.interface';
import { ProviderLinkConfirmationJob } from '../interfaces/provider-link-confirmation-job.interface';
import type { MailSender } from '../interfaces/send-mail-options.interface';
import { ProviderLinkEmailTemplateService } from '../provider-link-email-template.service';

@Injectable()
export class ProviderLinkConfirmationHandler
  implements EmailJobHandler<ProviderLinkConfirmationJob>, OnModuleInit
{
  readonly jobName = AUTH_PROVIDER_LINK_CONFIRMATION_JOB;

  constructor(
    private readonly registry: EmailJobRegistry,
    private readonly templateService: ProviderLinkEmailTemplateService,
    @Inject(SMTP_MAIL_SENDER)
    private readonly mailSender: MailSender,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(ProviderLinkConfirmationHandler.name);
  }

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(
    job: Job<ProviderLinkConfirmationJob, void, string>,
  ): Promise<void> {
    const { pendingId, recipient, rawToken, expiresAt } = job.data;
    const expiresAtMs = new Date(expiresAt).getTime();

    if (Date.now() >= expiresAtMs) {
      this.logger.log(
        `Job ${job.id ?? 'unknown'} for pendingId ${pendingId} is expired, skipping delivery`,
      );
      return;
    }

    const template = this.templateService.render(rawToken);

    try {
      await this.mailSender.send({
        to: recipient,
        subject: template.subject,
        text: template.text,
        html: template.html,
        jobId: job.id,
      });

      this.logger.log(
        `Delivered confirmation email for job ${job.id ?? 'unknown'} (pendingId: ${pendingId})`,
      );
    } catch (error) {
      const err = error as { name?: string; code?: string };
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts?.attempts ?? 1;
      this.logger.error(
        `Failed to deliver email for job ${job.id ?? 'unknown'} (pendingId: ${pendingId}, attempt: ${currentAttempt}/${maxAttempts}, error: ${err.code || err.name || 'UNKNOWN'})`,
      );
      throw error;
    }
  }
}

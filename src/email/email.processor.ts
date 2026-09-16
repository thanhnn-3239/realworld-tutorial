import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CustomLoggerService } from '../logger/logger.service';
import {
  AUTH_PROVIDER_LINK_CONFIRMATION_JOB,
  EMAIL_QUEUE_NAME,
  EMAIL_WORKER_CONFIG_KEY,
} from './constants/email-queue.constants';
import { SMTP_MAIL_SENDER } from './constants/mail-sender.constants';
import type { MailSender } from './interfaces/send-mail-options.interface';
import { ProviderLinkConfirmationJob } from './interfaces/provider-link-confirmation-job.interface';
import { ProviderLinkEmailTemplateService } from './provider-link-email-template.service';

@Processor({
  name: EMAIL_QUEUE_NAME,
  configKey: EMAIL_WORKER_CONFIG_KEY,
})
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly templateService: ProviderLinkEmailTemplateService,
    @Inject(SMTP_MAIL_SENDER)
    private readonly mailSender: MailSender,
    private readonly logger: CustomLoggerService,
  ) {
    super();
    this.logger.setContext(EmailProcessor.name);
  }

  async process(
    job: Job<ProviderLinkConfirmationJob, void, string>,
  ): Promise<void> {
    switch (job.name) {
      case AUTH_PROVIDER_LINK_CONFIRMATION_JOB:
        return this.handleProviderLinkConfirmation(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleProviderLinkConfirmation(
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
      const message =
        error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(
        `Failed to deliver email for job ${job.id ?? 'unknown'} (pendingId: ${pendingId}, attempt: ${job.attemptsMade + 1}): ${message}`,
      );
      throw error;
    }
  }
}

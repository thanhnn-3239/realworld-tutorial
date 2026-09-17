import { Inject } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
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
      const err = error as { name?: string; code?: string };
      const currentAttempt = job.attemptsMade + 1;
      const maxAttempts = job.opts?.attempts ?? 1;
      this.logger.error(
        `Failed to deliver email for job ${job.id ?? 'unknown'} (pendingId: ${pendingId}, attempt: ${currentAttempt}/${maxAttempts}, error: ${err.code || err.name || 'UNKNOWN'})`,
      );
      throw error;
    }
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

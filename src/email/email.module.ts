import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import {
  EMAIL_PRODUCER_CONFIG_KEY,
  EMAIL_QUEUE_NAME,
} from './constants/email-queue.constants';
import { SMTP_MAIL_SENDER } from './constants/mail-sender.constants';
import { EmailJobRegistry } from './email-job.registry';
import { EmailQueueProducer } from './email-queue.producer';
import { EmailQueueReadinessService } from './email-queue-readiness.service';
import { EmailProcessor } from './email.processor';
import { ProviderLinkConfirmationHandler } from './handlers/provider-link-confirmation.handler';
import { ProviderLinkEmailTemplateService } from './provider-link-email-template.service';
import { SmtpMailSender } from './smtp-mail-sender';

@Module({
  imports: [
    BackgroundJobsModule,
    BullModule.registerQueueAsync({
      // A distinct DI token lets processor discovery use email-worker config.
      // The factory name remains the actual Redis queue shared by both clients.
      name: EMAIL_PRODUCER_CONFIG_KEY,
      configKey: EMAIL_PRODUCER_CONFIG_KEY,
      useFactory: () => ({ name: EMAIL_QUEUE_NAME }),
    }),
  ],
  providers: [
    EmailJobRegistry,
    EmailQueueProducer,
    EmailQueueReadinessService,
    EmailProcessor,
    ProviderLinkConfirmationHandler,
    ProviderLinkEmailTemplateService,
    {
      provide: SMTP_MAIL_SENDER,
      useClass: SmtpMailSender,
    },
  ],
  exports: [
    BullModule,
    EmailJobRegistry,
    EmailQueueProducer,
    EmailQueueReadinessService,
    SMTP_MAIL_SENDER,
  ],
})
export class EmailModule {}

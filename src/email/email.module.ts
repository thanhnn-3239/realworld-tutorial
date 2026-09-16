import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import {
  EMAIL_PRODUCER_CONFIG_KEY,
  EMAIL_QUEUE_NAME,
} from './constants/email-queue.constants';
import { SMTP_MAIL_SENDER } from './constants/mail-sender.constants';
import { EmailQueueProducer } from './email-queue.producer';
import { EmailProcessor } from './email.processor';
import { ProviderLinkEmailTemplateService } from './provider-link-email-template.service';
import { SmtpMailSender } from './smtp-mail-sender';

@Module({
  imports: [
    BackgroundJobsModule,
    BullModule.registerQueue({
      name: EMAIL_QUEUE_NAME,
      configKey: EMAIL_PRODUCER_CONFIG_KEY,
    }),
  ],
  providers: [
    EmailQueueProducer,
    EmailProcessor,
    ProviderLinkEmailTemplateService,
    {
      provide: SMTP_MAIL_SENDER,
      useClass: SmtpMailSender,
    },
  ],
  exports: [BullModule, EmailQueueProducer, SMTP_MAIL_SENDER],
})
export class EmailModule {}

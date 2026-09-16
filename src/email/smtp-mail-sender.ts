import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { CustomLoggerService } from '../logger/logger.service';
import { EmailConfig, parseEmailConfig } from './email.config';
import {
  MailSender,
  SendMailOptions,
} from './interfaces/send-mail-options.interface';

@Injectable()
export class SmtpMailSender implements MailSender, OnModuleDestroy {
  private readonly config: EmailConfig;
  private readonly transporter: Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLoggerService,
  ) {
    this.logger.setContext(SmtpMailSender.name);
    this.config = parseEmailConfig(this.configService);

    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      requireTLS: this.config.smtpRequireTls,
      auth:
        this.config.smtpUser && this.config.smtpPassword
          ? {
              user: this.config.smtpUser,
              pass: this.config.smtpPassword,
            }
          : undefined,
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    const jobIdentifier = options.jobId ?? 'unknown';

    try {
      const info = await this.transporter.sendMail({
        from: this.config.mailFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(
        `Email delivered for jobId: ${jobIdentifier}, messageId: ${info?.messageId ?? 'none'}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown transport error';
      this.logger.error(
        `Failed to send email for jobId: ${jobIdentifier}: ${message}`,
      );
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }
}

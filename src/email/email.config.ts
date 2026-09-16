import { ConfigService } from '@nestjs/config';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  mailFrom: string;
  googleLinkConfirmUrl: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  smtpRequireTls: boolean;
}

type ConfigSource = ConfigService | Record<string, string | undefined>;

const getVal = (source: ConfigSource, key: string): string | undefined =>
  typeof (source as ConfigService).get === 'function'
    ? (source as ConfigService).get<string>(key)
    : (source as Record<string, string | undefined>)[key];

export function parseEmailConfig(source: ConfigSource): EmailConfig {
  return {
    smtpHost: getVal(source, 'SMTP_HOST') || 'localhost',
    smtpPort: Number(getVal(source, 'SMTP_PORT')) || 1025,
    mailFrom: getVal(source, 'MAIL_FROM') || 'no-reply@realworld.test',
    googleLinkConfirmUrl:
      getVal(source, 'GOOGLE_LINK_CONFIRM_URL') ||
      'http://localhost:3000/auth/google/link/confirm',
    smtpUser: getVal(source, 'SMTP_USER') || undefined,
    smtpPassword: getVal(source, 'SMTP_PASSWORD') || undefined,
    smtpSecure: getVal(source, 'SMTP_SECURE') === 'true',
    smtpRequireTls: getVal(source, 'SMTP_REQUIRE_TLS') === 'true',
  };
}

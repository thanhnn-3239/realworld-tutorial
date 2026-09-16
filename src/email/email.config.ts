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

type ConfigSource =
  | ConfigService
  | Record<string, string | undefined>
  | NodeJS.ProcessEnv;

function getValue(source: ConfigSource, key: string): string | undefined {
  if ('get' in source && typeof (source as ConfigService).get === 'function') {
    return (source as ConfigService).get<string>(key);
  }
  return (source as Record<string, string | undefined>)[key];
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }
  return false;
}

export function parseEmailConfig(
  source: ConfigSource,
  nodeEnv?: string,
): EmailConfig {
  const env =
    nodeEnv ??
    getValue(source, 'NODE_ENV') ??
    process.env.NODE_ENV ??
    'development';

  const rawHost = getValue(source, 'SMTP_HOST');
  if (!rawHost || rawHost.trim().length === 0) {
    throw new Error('SMTP_HOST is required');
  }
  const smtpHost = rawHost.trim();

  const rawPort = getValue(source, 'SMTP_PORT');
  if (!rawPort || !/^\d+$/u.test(String(rawPort).trim())) {
    throw new Error('SMTP_PORT must be a valid port number (1-65535)');
  }
  const smtpPort = Number(String(rawPort).trim());
  if (smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number (1-65535)');
  }

  const rawFrom = getValue(source, 'MAIL_FROM');
  if (!rawFrom || rawFrom.trim().length === 0) {
    throw new Error('MAIL_FROM is required');
  }
  const mailFrom = rawFrom.trim();

  const rawConfirmUrl = getValue(source, 'GOOGLE_LINK_CONFIRM_URL');
  if (!rawConfirmUrl || rawConfirmUrl.trim().length === 0) {
    throw new Error('GOOGLE_LINK_CONFIRM_URL is required');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawConfirmUrl.trim());
  } catch {
    throw new Error(
      'GOOGLE_LINK_CONFIRM_URL must be a valid HTTP or HTTPS URL',
    );
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('GOOGLE_LINK_CONFIRM_URL must use http or https');
  }
  const googleLinkConfirmUrl = parsedUrl.toString();

  const rawUser = getValue(source, 'SMTP_USER')?.trim();
  const rawPassword = getValue(source, 'SMTP_PASSWORD')?.trim();

  if ((rawUser && !rawPassword) || (!rawUser && rawPassword)) {
    throw new Error(
      'Both SMTP_USER and SMTP_PASSWORD must be provided together',
    );
  }

  const smtpSecure = parseBoolean(getValue(source, 'SMTP_SECURE'));
  const smtpRequireTls = parseBoolean(getValue(source, 'SMTP_REQUIRE_TLS'));

  if (env === 'production' && !smtpSecure && !smtpRequireTls) {
    throw new Error(
      'Production SMTP requires either SMTP_SECURE or SMTP_REQUIRE_TLS',
    );
  }

  return {
    smtpHost,
    smtpPort,
    mailFrom,
    googleLinkConfirmUrl,
    smtpUser: rawUser || undefined,
    smtpPassword: rawPassword || undefined,
    smtpSecure,
    smtpRequireTls,
  };
}

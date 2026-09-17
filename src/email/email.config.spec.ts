import { ConfigService } from '@nestjs/config';
import { parseEmailConfig } from './email.config';

describe('parseEmailConfig', () => {
  const validBase = {
    SMTP_HOST: 'mailpit',
    SMTP_PORT: '1025',
    MAIL_FROM: 'no-reply@realworld.test',
    GOOGLE_LINK_CONFIRM_URL: 'http://frontend.test/auth/google/link/confirm',
  };

  it('parses minimal valid configuration with default TLS and no auth', () => {
    const config = parseEmailConfig(validBase);
    expect(config).toEqual({
      smtpHost: 'mailpit',
      smtpPort: 1025,
      mailFrom: 'no-reply@realworld.test',
      googleLinkConfirmUrl: 'http://frontend.test/auth/google/link/confirm',
      smtpUser: undefined,
      smtpPassword: undefined,
      smtpSecure: false,
      smtpRequireTls: false,
    });
  });

  it('parses full configuration with credentials and TLS options', () => {
    const config = parseEmailConfig({
      ...validBase,
      SMTP_USER: 'app-user',
      SMTP_PASSWORD: 'app-password',
      SMTP_SECURE: 'true',
      SMTP_REQUIRE_TLS: 'true',
    });
    expect(config.smtpUser).toBe('app-user');
    expect(config.smtpPassword).toBe('app-password');
    expect(config.smtpSecure).toBe(true);
    expect(config.smtpRequireTls).toBe(true);
  });

  it('applies defaults when values are missing', () => {
    const config = parseEmailConfig({});
    expect(config).toEqual({
      smtpHost: 'localhost',
      smtpPort: 1025,
      mailFrom: 'no-reply@realworld.test',
      googleLinkConfirmUrl: 'http://localhost:3000/auth/google/link/confirm',
      smtpUser: undefined,
      smtpPassword: undefined,
      smtpSecure: false,
      smtpRequireTls: false,
    });
  });

  it('reads from ConfigService instance', () => {
    const mockConfigService = {
      get: jest.fn((key: string) => validBase[key as keyof typeof validBase]),
    } as unknown as ConfigService;

    const config = parseEmailConfig(mockConfigService);
    expect(config.smtpHost).toBe('mailpit');
    expect(config.smtpPort).toBe(1025);
  });
});

import { parseEmailConfig } from './email.config';

describe('parseEmailConfig', () => {
  const validBase = {
    SMTP_HOST: 'mailpit',
    SMTP_PORT: '1025',
    MAIL_FROM: 'no-reply@realworld.test',
    GOOGLE_LINK_CONFIRM_URL: 'http://frontend.test/auth/google/link/confirm',
  };

  it('parses minimal valid configuration with default TLS and no auth', () => {
    const config = parseEmailConfig(validBase, 'test');
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
    const config = parseEmailConfig(
      {
        ...validBase,
        SMTP_USER: 'app-user',
        SMTP_PASSWORD: 'app-password',
        SMTP_SECURE: 'true',
        SMTP_REQUIRE_TLS: 'true',
      },
      'test',
    );
    expect(config.smtpUser).toBe('app-user');
    expect(config.smtpPassword).toBe('app-password');
    expect(config.smtpSecure).toBe(true);
    expect(config.smtpRequireTls).toBe(true);
  });

  it('rejects missing or whitespace-only SMTP_HOST', () => {
    expect(() =>
      parseEmailConfig({ ...validBase, SMTP_HOST: ' ' }, 'test'),
    ).toThrow('SMTP_HOST is required');
  });

  it.each(['', 'abc', '0', '-1', '65536'])(
    'rejects invalid port "%s"',
    (port) => {
      expect(() =>
        parseEmailConfig({ ...validBase, SMTP_PORT: port }, 'test'),
      ).toThrow('SMTP_PORT must be a valid port number (1-65535)');
    },
  );

  it('rejects missing or whitespace-only MAIL_FROM', () => {
    expect(() =>
      parseEmailConfig({ ...validBase, MAIL_FROM: ' ' }, 'test'),
    ).toThrow('MAIL_FROM is required');
  });

  it.each([
    ['not a url', 'GOOGLE_LINK_CONFIRM_URL must be a valid HTTP or HTTPS URL'],
    [
      'ftp://frontend.test/confirm',
      'GOOGLE_LINK_CONFIRM_URL must use http or https',
    ],
  ])('rejects invalid confirm url: %s', (url, expectedMessage) => {
    expect(() =>
      parseEmailConfig({ ...validBase, GOOGLE_LINK_CONFIRM_URL: url }, 'test'),
    ).toThrow(expectedMessage);
  });

  it('rejects username without password', () => {
    expect(() =>
      parseEmailConfig({ ...validBase, SMTP_USER: 'user' }, 'test'),
    ).toThrow('Both SMTP_USER and SMTP_PASSWORD must be provided together');
  });

  it('rejects password without username', () => {
    expect(() =>
      parseEmailConfig({ ...validBase, SMTP_PASSWORD: 'pass' }, 'test'),
    ).toThrow('Both SMTP_USER and SMTP_PASSWORD must be provided together');
  });

  describe('production TLS requirements', () => {
    it('rejects production config when both secure and requireTLS are false', () => {
      expect(() =>
        parseEmailConfig(
          {
            ...validBase,
            SMTP_SECURE: 'false',
            SMTP_REQUIRE_TLS: 'false',
          },
          'production',
        ),
      ).toThrow(
        'Production SMTP requires either SMTP_SECURE or SMTP_REQUIRE_TLS',
      );
    });

    it('accepts production config with SMTP_SECURE=true', () => {
      const config = parseEmailConfig(
        { ...validBase, SMTP_SECURE: 'true' },
        'production',
      );
      expect(config.smtpSecure).toBe(true);
    });

    it('accepts production config with SMTP_REQUIRE_TLS=true', () => {
      const config = parseEmailConfig(
        { ...validBase, SMTP_REQUIRE_TLS: 'true' },
        'production',
      );
      expect(config.smtpRequireTls).toBe(true);
    });
  });
});

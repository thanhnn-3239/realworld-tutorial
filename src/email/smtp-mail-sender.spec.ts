import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../logger/logger.service';
import { SmtpMailSender } from './smtp-mail-sender';
import { SendMailOptions } from './interfaces/send-mail-options.interface';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('SmtpMailSender', () => {
  let sender: SmtpMailSender;
  let mockTransporter: {
    sendMail: jest.Mock;
    close: jest.Mock;
  };
  let mockLogger: {
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
    setContext: jest.Mock;
  };

  const email = 'user@example.com';
  const bodyText = 'Sensitive body with secret token';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        MAIL_FROM: 'no-reply@example.com',
        GOOGLE_LINK_CONFIRM_URL: 'https://app.example.com/confirm',
        SMTP_SECURE: 'false',
        SMTP_REQUIRE_TLS: 'true',
      };
      return map[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '<msg-123@smtp>' }),
      close: jest.fn(),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
    };

    sender = new SmtpMailSender(
      mockConfigService,
      mockLogger as unknown as CustomLoggerService,
    );
  });

  it('creates transport with configuration without connecting', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
      }),
    );
  });

  it('sends mail with configured from address and options', async () => {
    const options: SendMailOptions = {
      to: email,
      subject: 'Test Subject',
      text: bodyText,
      html: `<p>${bodyText}</p>`,
      jobId: 'job-42',
    };

    await sender.send(options);

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: email,
      subject: 'Test Subject',
      text: bodyText,
      html: `<p>${bodyText}</p>`,
    });
  });

  it('logs job and message ID without logging recipient or body content', async () => {
    const options: SendMailOptions = {
      to: email,
      subject: 'Test Subject',
      text: bodyText,
      html: `<p>${bodyText}</p>`,
      jobId: 'job-42',
    };

    await sender.send(options);

    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('job-42'),
    );
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('<msg-123@smtp>'),
    );

    const loggedMessages = mockLogger.log.mock.calls.map((c) => c[0]).join(' ');
    expect(loggedMessages).not.toContain(email);
    expect(loggedMessages).not.toContain(bodyText);
  });

  it('logs sanitized error and rethrows when sendMail fails', async () => {
    const forbidden = [
      email,
      bodyText,
      'secret-raw-token',
      'https://app.example.com/confirm?token=secret-raw-token',
      'smtp-login',
      'smtp-password',
      '<p>private HTML payload</p>',
    ];
    const error = new Error(forbidden.join(' '));
    mockTransporter.sendMail.mockRejectedValue(error);

    const options: SendMailOptions = {
      to: email,
      subject: 'Test Subject',
      text: bodyText,
      html: `<p>${bodyText}</p>`,
      jobId: 'job-99',
    };

    await expect(sender.send(options)).rejects.toBe(error);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('job-99'),
    );
    const errorMessages = JSON.stringify([
      ...mockLogger.log.mock.calls,
      ...mockLogger.error.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.debug.mock.calls,
    ]);
    for (const value of forbidden) expect(errorMessages).not.toContain(value);
  });

  it('closes transporter on module destroy', () => {
    sender.onModuleDestroy();
    expect(mockTransporter.close).toHaveBeenCalled();
  });
});

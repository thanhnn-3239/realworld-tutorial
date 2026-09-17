import { ConfigService } from '@nestjs/config';
import { ProviderLinkEmailTemplateService } from './provider-link-email-template.service';

describe('ProviderLinkEmailTemplateService', () => {
  let service: ProviderLinkEmailTemplateService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GOOGLE_LINK_CONFIRM_URL') {
        return 'http://frontend.test/auth/google/link/confirm';
      }
      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      if (key === 'GOOGLE_LINK_CONFIRM_URL') {
        return 'http://frontend.test/auth/google/link/confirm';
      }
      throw new Error(`Missing ${key}`);
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    service = new ProviderLinkEmailTemplateService(mockConfigService);
  });

  it('renders confirmation email with text and html bodies', () => {
    const rawToken = 'test-token-12345';
    const result = service.render(rawToken);

    expect(result.subject).toBe('Confirm your Google account link');
    expect(result.text).toContain('Confirm the link within 15 minutes:');
    expect(result.text).toContain(
      'http://frontend.test/auth/google/link/confirm?token=test-token-12345',
    );
    expect(result.html).toContain('conduit');
    expect(result.html).toContain('15 minutes');
    expect(result.html).toContain(
      'href="http://frontend.test/auth/google/link/confirm?token=test-token-12345"',
    );
    expect(result.html).toContain('Confirm Google account');
  });

  it('safely URL-encodes special characters in raw token', () => {
    const rawToken = 'token+with/special=chars&more';
    const result = service.render(rawToken);

    expect(result.text).toContain(
      'token=token%2Bwith%2Fspecial%3Dchars%26more',
    );
    expect(result.html).toContain(
      'token=token%2Bwith%2Fspecial%3Dchars%26more',
    );
  });

  it('escapes HTML special characters in the confirmation link', () => {
    const baseWithAmp = {
      get: jest.fn(() => 'http://frontend.test/confirm?mode=link&lang=en'),
    } as unknown as ConfigService;
    const customService = new ProviderLinkEmailTemplateService(baseWithAmp);

    const result = customService.render('token-abc');
    expect(result.html).toContain(
      'http://frontend.test/confirm?mode=link&amp;lang=en&amp;token=token-abc',
    );
  });

  it('falls back to default confirm URL when unset', () => {
    const emptyConfig = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const defaultService = new ProviderLinkEmailTemplateService(emptyConfig);
    const result = defaultService.render('test-token');
    expect(result.text).toContain(
      'http://localhost:3000/auth/google/link/confirm?token=test-token',
    );
  });
});

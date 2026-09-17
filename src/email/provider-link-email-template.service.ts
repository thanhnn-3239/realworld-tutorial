import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildProviderLinkEmailHtml } from './templates/provider-link-email-html.template';

export interface ProviderLinkEmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class ProviderLinkEmailTemplateService {
  private readonly confirmUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.confirmUrl =
      this.configService.get<string>('GOOGLE_LINK_CONFIRM_URL') ||
      'http://localhost:3000/auth/google/link/confirm';
  }

  render(rawToken: string): ProviderLinkEmailContent {
    const url = new URL(this.confirmUrl);
    url.searchParams.set('token', rawToken);
    const urlString = url.toString();

    return {
      subject: 'Confirm your Google account link',
      text: [
        'Conduit - Confirm your Google account link',
        '',
        'We received a request to sign in with Google using this email address for your Conduit account.',
        'Your existing password has not been changed and remains secure.',
        '',
        'Confirm the link within 15 minutes:',
        urlString,
        '',
        'If you did not make this request, you can safely ignore this email.',
        'Your Conduit account and password remain completely secure.',
      ].join('\n'),
      html: buildProviderLinkEmailHtml(escapeHtml(urlString)),
    };
  }
}

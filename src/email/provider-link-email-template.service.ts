import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

    return {
      subject: 'Confirm your Google account link',
      text: 'Confirm the link within 15 minutes: ' + url.toString(),
      html:
        '<p>Confirm this Google account link within 15 minutes.</p>' +
        '<p><a href="' +
        escapeHtml(url.toString()) +
        '">Confirm Google account</a></p>',
    };
  }
}

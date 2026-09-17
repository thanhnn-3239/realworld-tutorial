import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PROVIDER_LINK_TOKEN_BYTE_LENGTH } from './constants/provider-link-token.constants';
import { ProviderLinkToken } from './interfaces/provider-link-token.interface';

@Injectable()
export class ProviderLinkTokenService {
  issue(): ProviderLinkToken {
    const rawToken = randomBytes(PROVIDER_LINK_TOKEN_BYTE_LENGTH).toString(
      'base64url',
    );
    const tokenHash = this.hash(rawToken);

    return { rawToken, tokenHash };
  }

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}

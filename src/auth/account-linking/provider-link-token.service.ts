import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ProviderLinkToken } from './interfaces/provider-link-token.interface';

const TOKEN_BYTE_LENGTH = 32;

@Injectable()
export class ProviderLinkTokenService {
  issue(): ProviderLinkToken {
    const rawToken = randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
    const tokenHash = this.hash(rawToken);

    return { rawToken, tokenHash };
  }

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}

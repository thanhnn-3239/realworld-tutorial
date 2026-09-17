import { createHash, randomBytes } from 'node:crypto';
import { PROVIDER_LINK_TOKEN_BYTE_LENGTH } from './constants/provider-link-token.constants';
import { ProviderLinkToken } from './interfaces/provider-link-token.interface';

export function issueProviderLinkToken(): ProviderLinkToken {
  const rawToken = randomBytes(PROVIDER_LINK_TOKEN_BYTE_LENGTH).toString(
    'base64url',
  );
  return { rawToken, tokenHash: hashProviderLinkToken(rawToken) };
}

export function hashProviderLinkToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

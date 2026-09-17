import {
  hashProviderLinkToken,
  issueProviderLinkToken,
} from './provider-link-token.util';

describe('provider-link-token.util', () => {
  describe('issueProviderLinkToken', () => {
    it('issues a token with 43-char base64url rawToken and 64-char lowercase hex hash', () => {
      const token = issueProviderLinkToken();

      expect(token.rawToken).toHaveLength(43);
      expect(token.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(token.tokenHash).toHaveLength(64);
      expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('matches the hash of the raw token deterministically', () => {
      const token = issueProviderLinkToken();
      const rehashed = hashProviderLinkToken(token.rawToken);

      expect(token.tokenHash).toBe(rehashed);
    });

    it('produces unique tokens across calls', () => {
      const first = issueProviderLinkToken();
      const second = issueProviderLinkToken();

      expect(first.rawToken).not.toBe(second.rawToken);
      expect(first.tokenHash).not.toBe(second.tokenHash);
    });
  });

  describe('hashProviderLinkToken', () => {
    it('hashes raw input deterministically with sha256 lowercase hex', () => {
      const raw = 'test-raw-token-value-12345';
      const hash1 = hashProviderLinkToken(raw);
      const hash2 = hashProviderLinkToken(raw);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
    });
  });
});

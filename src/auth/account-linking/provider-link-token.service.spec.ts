import { ProviderLinkTokenService } from './provider-link-token.service';

describe('ProviderLinkTokenService', () => {
  let service: ProviderLinkTokenService;

  beforeEach(() => {
    service = new ProviderLinkTokenService();
  });

  describe('issue', () => {
    it('issues a token with 43-char base64url rawToken and 64-char lowercase hex hash', () => {
      const token = service.issue();

      expect(token.rawToken).toHaveLength(43);
      expect(token.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(token.tokenHash).toHaveLength(64);
      expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('matches the hash of the raw token deterministically', () => {
      const token = service.issue();
      const rehashed = service.hash(token.rawToken);

      expect(token.tokenHash).toBe(rehashed);
    });

    it('produces unique tokens across calls', () => {
      const first = service.issue();
      const second = service.issue();

      expect(first.rawToken).not.toBe(second.rawToken);
      expect(first.tokenHash).not.toBe(second.tokenHash);
    });
  });

  describe('hash', () => {
    it('hashes raw input deterministically with sha256 lowercase hex', () => {
      const raw = 'test-raw-token-value-12345';
      const hash1 = service.hash(raw);
      const hash2 = service.hash(raw);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
    });
  });
});

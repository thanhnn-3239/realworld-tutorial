import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProviderLinkService } from './provider-link.service';
import {
  createPendingRowFixture,
  createTestProviderLinkService,
  mockIssuedPending,
  MOCK_LINK_REQUEST,
  MOCK_RAW_TOKEN,
  MOCK_TOKEN_HASH,
  setupTestMocks,
} from './testing/provider-link-test-fixtures';

describe('ProviderLinkService', () => {
  let service: ProviderLinkService;
  let mocks: ReturnType<typeof setupTestMocks>;

  beforeEach(() => {
    mocks = setupTestMocks();
    service = createTestProviderLinkService(mocks);
  });

  describe('requestLink', () => {
    it('enqueues confirmation email when link is issued', async () => {
      mockIssuedPending(mocks.pendingRepo);

      const res = await service.requestLink(MOCK_LINK_REQUEST);

      expect(res).toEqual({ kind: 'issued', pendingId: 42 });
      expect(
        mocks.emailQueue.enqueueProviderLinkConfirmation,
      ).toHaveBeenCalledWith({
        job: expect.objectContaining({
          pendingId: 42,
          recipient: MOCK_LINK_REQUEST.recipient,
          rawToken: MOCK_RAW_TOKEN,
        }),
        tokenHashPrefix: MOCK_TOKEN_HASH.slice(0, 8),
      });
    });

    it('does not enqueue email when repository returns cooldown', async () => {
      mocks.pendingRepo.issue.mockResolvedValue({
        kind: 'cooldown',
        pendingId: 42,
      });

      const res = await service.requestLink(MOCK_LINK_REQUEST);

      expect(res).toEqual({ kind: 'cooldown', pendingId: 42 });
      expect(
        mocks.emailQueue.enqueueProviderLinkConfirmation,
      ).not.toHaveBeenCalled();
    });

    it('compensates via deleteIfCurrent and throws 503 on enqueue error', async () => {
      mockIssuedPending(mocks.pendingRepo);
      mocks.emailQueue.enqueueProviderLinkConfirmation.mockRejectedValue(
        new Error('Redis down'),
      );
      mocks.pendingRepo.deleteIfCurrent.mockResolvedValue(true);

      await expect(service.requestLink(MOCK_LINK_REQUEST)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mocks.pendingRepo.deleteIfCurrent).toHaveBeenCalledWith(
        42,
        MOCK_TOKEN_HASH,
      );
    });

    it('swallows compensation error, logs identifiers without token/email, and throws 503', async () => {
      mockIssuedPending(mocks.pendingRepo);
      mocks.emailQueue.enqueueProviderLinkConfirmation.mockRejectedValue(
        new Error('Redis down'),
      );
      mocks.pendingRepo.deleteIfCurrent.mockRejectedValue(
        new Error('DB failure'),
      );

      await expect(service.requestLink(MOCK_LINK_REQUEST)).rejects.toThrow(
        ServiceUnavailableException,
      );

      const logs = mocks.logger.error.mock.calls
        .map((c) => c.join(' '))
        .join(' ');
      expect(logs).toContain('42');
      expect(logs).not.toContain(MOCK_RAW_TOKEN);
      expect(logs).not.toContain(MOCK_LINK_REQUEST.recipient);
    });
  });

  describe('confirm', () => {
    it('claims pending link and creates AuthProvider atomically', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(true);
      mocks.authProviders.findAccountByProvider.mockResolvedValue(null);
      mocks.authProviders.create.mockResolvedValue(undefined);

      const res = await service.confirm(MOCK_RAW_TOKEN);

      expect(res).toEqual({ kind: 'confirmed' });
      expect(mocks.pendingRepo.claim).toHaveBeenCalledWith(
        10,
        MOCK_TOKEN_HASH,
        expect.any(Date),
        expect.anything(),
      );
      expect(mocks.authProviders.create).toHaveBeenCalledWith(
        7,
        { provider: 'google', providerAccountId: 'google-sub-1' },
        expect.anything(),
      );
    });

    it('returns already-confirmed when provider is already attached to same user', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(true);
      mocks.authProviders.findAccountByProvider.mockResolvedValue({ id: 7 });

      const res = await service.confirm(MOCK_RAW_TOKEN);

      expect(res).toEqual({ kind: 'already-confirmed' });
      expect(mocks.authProviders.create).not.toHaveBeenCalled();
    });

    it('returns already-confirmed when concurrent request lost claim but link created for same user', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(false);
      mocks.authProviders.findAccountByProvider.mockResolvedValue({ id: 7 });

      const res = await service.confirm(MOCK_RAW_TOKEN);

      expect(res).toEqual({ kind: 'already-confirmed' });
    });

    it('rejects with 409 conflict when provider is linked to another user', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(true);
      mocks.authProviders.findAccountByProvider.mockResolvedValue({ id: 99 });

      await expect(service.confirm(MOCK_RAW_TOKEN)).rejects.toThrow(
        ConflictException,
      );
      expect(mocks.authProviders.create).not.toHaveBeenCalled();
    });

    it('rejects with 400 when token is unknown, expired, or consumed', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(null);

      await expect(service.confirm(MOCK_RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects with 400 when claim lost and provider is not linked', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(false);
      mocks.authProviders.findAccountByProvider.mockResolvedValue(null);

      await expect(service.confirm(MOCK_RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('never mutates password or session repositories during confirmation', async () => {
      mocks.pendingRepo.findValid.mockResolvedValue(createPendingRowFixture());
      mocks.pendingRepo.claim.mockResolvedValue(true);
      mocks.authProviders.findAccountByProvider.mockResolvedValue(null);
      mocks.authProviders.create.mockResolvedValue(undefined);

      await service.confirm(MOCK_RAW_TOKEN);

      expect((service as any).passwordService).toBeUndefined();
      expect((service as any).refreshTokens).toBeUndefined();
    });
  });
});

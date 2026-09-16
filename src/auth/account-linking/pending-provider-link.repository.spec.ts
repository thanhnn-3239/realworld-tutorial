import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PendingProviderLinkRepository } from './pending-provider-link.repository';
import {
  BASE_TEST_DATE,
  createMockPendingPrisma,
  fakeIssueInput,
  fakePendingRow,
  MockPendingPrisma,
  P2002_ERROR,
} from './testing/pending-link-test-fixtures';

describe('PendingProviderLinkRepository', () => {
  let repository: PendingProviderLinkRepository;
  let mockPrisma: MockPendingPrisma;

  beforeEach(() => {
    mockPrisma = createMockPendingPrisma();
    repository = new PendingProviderLinkRepository(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('issue', () => {
    it('creates row and never writes rawToken to database', async () => {
      const row = fakePendingRow();
      mockPrisma.pendingAuthProviderLink.findFirst.mockResolvedValue(null);
      mockPrisma.pendingAuthProviderLink.create.mockResolvedValue(row);

      const result = await repository.issue(fakeIssueInput());

      expect(result).toEqual({
        kind: 'issued',
        pendingId: row.id,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
      });
      const createArg =
        mockPrisma.pendingAuthProviderLink.create.mock.calls[0][0];
      expect(createArg.data).toEqual(
        expect.objectContaining({
          userId: 10,
          provider: 'google',
          tokenHash: 'hash-1',
        }),
      );
      expect(createArg.data).not.toHaveProperty('rawToken');
    });

    it('returns cooldown without rotating when within 60 seconds', async () => {
      mockPrisma.pendingAuthProviderLink.findFirst.mockResolvedValue(
        fakePendingRow({ id: 42, createdAt: BASE_TEST_DATE }),
      );

      const result = await repository.issue(
        fakeIssueInput({ now: new Date('2026-09-16T12:00:30Z') }),
      );

      expect(result).toEqual({ kind: 'cooldown', pendingId: 42 });
      expect(
        mockPrisma.pendingAuthProviderLink.updateMany,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.pendingAuthProviderLink.create).not.toHaveBeenCalled();
    });

    it('rotates token when past 60 seconds cooldown', async () => {
      const now = new Date('2026-09-16T12:01:05Z');
      const expiresAt = new Date('2026-09-16T12:15:00Z');
      mockPrisma.pendingAuthProviderLink.findFirst.mockResolvedValue(
        fakePendingRow({ id: 42 }),
      );
      mockPrisma.pendingAuthProviderLink.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await repository.issue(
        fakeIssueInput({ tokenHash: 'rotated-hash', expiresAt, now }),
      );

      expect(result).toEqual({
        kind: 'issued',
        pendingId: 42,
        tokenHash: 'rotated-hash',
        expiresAt,
      });
      expect(
        mockPrisma.pendingAuthProviderLink.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: 42,
          tokenHash: 'hash-1',
          createdAt: BASE_TEST_DATE,
        },
        data: expect.objectContaining({
          tokenHash: 'rotated-hash',
          createdAt: now,
        }),
      });
    });

    it('returns cooldown after losing a concurrent token rotation', async () => {
      const now = new Date('2026-09-16T12:01:05Z');
      mockPrisma.pendingAuthProviderLink.findFirst
        .mockResolvedValueOnce(fakePendingRow({ id: 42 }))
        .mockResolvedValueOnce(
          fakePendingRow({ id: 42, tokenHash: 'winner-hash', createdAt: now }),
        );
      mockPrisma.pendingAuthProviderLink.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await repository.issue(
        fakeIssueInput({ tokenHash: 'loser-hash', now }),
      );

      expect(result).toEqual({ kind: 'cooldown', pendingId: 42 });
      expect(
        mockPrisma.pendingAuthProviderLink.findFirst,
      ).toHaveBeenCalledTimes(2);
    });

    it('handles concurrent P2002 conflict on create by applying cooldown decision', async () => {
      const conflictRow = fakePendingRow({ id: 99, createdAt: BASE_TEST_DATE });
      mockPrisma.pendingAuthProviderLink.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(conflictRow);
      mockPrisma.pendingAuthProviderLink.create.mockRejectedValue(P2002_ERROR);

      const result = await repository.issue(
        fakeIssueInput({ now: new Date('2026-09-16T12:00:10Z') }),
      );

      expect(result).toEqual({ kind: 'cooldown', pendingId: 99 });
    });
  });

  describe('findValid', () => {
    it('queries for tokenHash and unexpired link', async () => {
      const row = fakePendingRow();
      mockPrisma.pendingAuthProviderLink.findFirst.mockResolvedValue(row);

      const found = await repository.findValid('hash-1', BASE_TEST_DATE);
      expect(found).not.toBeNull();
      expect(mockPrisma.pendingAuthProviderLink.findFirst).toHaveBeenCalledWith(
        {
          where: { tokenHash: 'hash-1', expiresAt: { gt: BASE_TEST_DATE } },
        },
      );
    });
  });

  describe('deleteIfCurrent', () => {
    it('returns true when row was deleted, false otherwise', async () => {
      mockPrisma.pendingAuthProviderLink.deleteMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      expect(await repository.deleteIfCurrent(1, 'hash-1')).toBe(true);
      expect(await repository.deleteIfCurrent(1, 'hash-1')).toBe(false);
    });
  });

  describe('claim', () => {
    it('claims conditionally within transaction', async () => {
      const txMock = {
        pendingAuthProviderLink: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      } as unknown as Prisma.TransactionClient;

      const claimed = await repository.claim(
        1,
        'hash-1',
        BASE_TEST_DATE,
        txMock,
      );
      expect(claimed).toBe(true);
    });
  });

  describe('deleteExpired', () => {
    it('deletes rows with expiresAt <= now and returns count', async () => {
      mockPrisma.pendingAuthProviderLink.deleteMany.mockResolvedValue({
        count: 5,
      });

      const count = await repository.deleteExpired(BASE_TEST_DATE);
      expect(count).toBe(5);
    });
  });
});

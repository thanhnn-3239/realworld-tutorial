import { PendingProviderLinkRepository } from '../src/auth/account-linking/pending-provider-link.repository';
import { useDatabaseSuite } from './support/database-suite';
import {
  issueLink,
  synchronizedIssuanceRepository,
  TEST_EXPIRES_AT,
} from './support/pending-provider-link-helpers';

describe('PendingProviderLinkRepository concurrency (e2e)', () => {
  const database = useDatabaseSuite('pending-provider-link-concurrency');

  async function expectOneIssued(
    repository: PendingProviderLinkRepository,
    userId: number,
    now: Date,
  ) {
    const results = await Promise.all(
      ['b', 'c'].map((hash) =>
        issueLink(repository, userId, 'sub-1', hash, TEST_EXPIRES_AT, now),
      ),
    );
    expect(results.map((result) => result.kind).sort()).toEqual([
      'cooldown',
      'issued',
    ]);
    const winner = results.find((result) => result.kind === 'issued')!;
    expect(await repository.findValid(winner.tokenHash, now)).toEqual(
      expect.objectContaining({ id: winner.pendingId }),
    );
    expect(await database.prisma.pendingAuthProviderLink.count()).toBe(1);
  }

  it('issues only one usable token for simultaneous resends after cooldown', async () => {
    const user = await database.fixtures.user();
    // Seed before installing the barrier so both resends observe the stale row.
    await database.prisma.pendingAuthProviderLink.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerAccountId: 'sub-1',
        tokenHash: 'a'.repeat(64),
        createdAt: new Date('2026-09-16T12:00:00Z'),
        expiresAt: TEST_EXPIRES_AT,
      },
    });
    await expectOneIssued(
      synchronizedIssuanceRepository(database.prisma),
      user.id,
      new Date('2026-09-16T12:01:05Z'),
    );
  });

  it('recovers concurrent create conflicts using standalone issuance', async () => {
    const user = await database.fixtures.user();
    await expectOneIssued(
      synchronizedIssuanceRepository(database.prisma),
      user.id,
      new Date('2026-09-16T12:00:00Z'),
    );
  });
});

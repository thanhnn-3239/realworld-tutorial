import { Prisma } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PendingProviderLinkRepository } from '../src/auth/account-linking/pending-provider-link.repository';
import { useDatabaseSuite } from './support/database-suite';
import { resetApplicationTables } from './support/database-reset';
import {
  claimInTx,
  dummyTokenHash,
  insertPendingLink,
  issueLink,
  seedExpiredPendingLinks,
  TEST_BASE_TIME,
  TEST_EXPIRES_AT,
} from './support/pending-provider-link-helpers';

describe('PendingProviderLinkRepository (e2e)', () => {
  const database = useDatabaseSuite('pending-provider-link');
  let repository: PendingProviderLinkRepository;

  beforeAll(() => {
    repository = new PendingProviderLinkRepository(
      database.prisma as unknown as PrismaService,
    );
  });

  it('issues, respects cooldown, rotates token, and reflects in findValid', async () => {
    const user = await database.fixtures.user();
    const first = await issueLink(repository, user.id, 'sub-1', 'a');
    expect(first.kind).toBe('issued');
    if (first.kind !== 'issued') return;

    const second = await issueLink(
      repository,
      user.id,
      'sub-1',
      'b',
      TEST_EXPIRES_AT,
      new Date('2026-09-16T12:00:30.000Z'),
    );
    expect(second).toEqual({ kind: 'cooldown', pendingId: first.pendingId });

    const rotatedTime = new Date('2026-09-16T12:01:05.000Z');
    const rotated = await issueLink(
      repository,
      user.id,
      'sub-1',
      'c',
      new Date('2026-09-16T12:16:05.000Z'),
      rotatedTime,
    );
    expect(rotated.kind).toBe('issued');
    if (rotated.kind !== 'issued') return;

    expect(rotated.tokenHash).not.toBe(first.tokenHash);
    expect(await repository.findValid(first.tokenHash, rotatedTime)).toBeNull();
    const valid = await repository.findValid(rotated.tokenHash, rotatedTime);
    expect(valid?.id).toBe(first.pendingId);
  });

  it('enforces unique constraints on (provider, providerAccountId) and (userId, provider)', async () => {
    const [user1, user2] = await Promise.all([
      database.fixtures.user(),
      database.fixtures.user(),
    ]);

    await insertPendingLink(
      database.prisma,
      user1.id,
      'shared-sub',
      dummyTokenHash('1'),
    );

    await expect(
      insertPendingLink(
        database.prisma,
        user2.id,
        'shared-sub',
        dummyTokenHash('2'),
      ),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);

    await expect(
      insertPendingLink(
        database.prisma,
        user1.id,
        'other-sub',
        dummyTokenHash('3'),
      ),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('handles expiry in findValid', async () => {
    const user = await database.fixtures.user();
    const tokenHash = dummyTokenHash('e');

    await issueLink(repository, user.id, 'expiring-sub', 'e');

    const before = await repository.findValid(
      tokenHash,
      new Date('2026-09-16T12:14:59.000Z'),
    );
    expect(before).not.toBeNull();

    const after = await repository.findValid(
      tokenHash,
      new Date('2026-09-16T12:15:01.000Z'),
    );
    expect(after).toBeNull();
  });

  it('performs conditional compensation with deleteIfCurrent', async () => {
    const user = await database.fixtures.user();
    const tokenHash = dummyTokenHash('d');

    const issued = await issueLink(repository, user.id, 'comp-sub', 'd');
    expect(issued.kind).toBe('issued');
    if (issued.kind !== 'issued') return;

    expect(
      await repository.deleteIfCurrent(issued.pendingId, 'wrong-hash'),
    ).toBe(false);
    expect(await repository.deleteIfCurrent(999999, tokenHash)).toBe(false);
    expect(await repository.deleteIfCurrent(issued.pendingId, tokenHash)).toBe(
      true,
    );
    expect(await repository.deleteIfCurrent(issued.pendingId, tokenHash)).toBe(
      false,
    );
  });

  it('conditionally claims unexpired pending links atomically', async () => {
    const user = await database.fixtures.user();
    const tokenHash = dummyTokenHash('f');

    const issued = await issueLink(repository, user.id, 'claim-sub', 'f');
    expect(issued.kind).toBe('issued');
    if (issued.kind !== 'issued') return;

    const expiredClaim = await claimInTx(
      database.prisma,
      repository,
      issued.pendingId,
      tokenHash,
      new Date('2026-09-16T12:16:00.000Z'),
    );
    expect(expiredClaim).toBe(false);

    const firstClaim = await claimInTx(
      database.prisma,
      repository,
      issued.pendingId,
      tokenHash,
      new Date('2026-09-16T12:05:00.000Z'),
    );
    expect(firstClaim).toBe(true);

    const secondClaim = await claimInTx(
      database.prisma,
      repository,
      issued.pendingId,
      tokenHash,
      new Date('2026-09-16T12:05:01.000Z'),
    );
    expect(secondClaim).toBe(false);
  });

  it('deletes expired links and returns cleanup count', async () => {
    const user = await database.fixtures.user();
    await seedExpiredPendingLinks(database.prisma, user.id, TEST_BASE_TIME);

    const deleted = await repository.deleteExpired(TEST_BASE_TIME);
    expect(deleted).toBe(2);
  });

  it('includes PendingAuthProviderLink in database reset', async () => {
    const user = await database.fixtures.user();
    await insertPendingLink(
      database.prisma,
      user.id,
      'reset-sub',
      dummyTokenHash('r'),
    );

    await resetApplicationTables(database.databaseUrl);
    const count = await database.prisma.pendingAuthProviderLink.count();
    expect(count).toBe(0);
  });
});

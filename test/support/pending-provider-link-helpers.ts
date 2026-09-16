import { PrismaClient } from '../../src/generated/prisma/client';
import { PendingProviderLinkRepository } from '../../src/auth/account-linking/pending-provider-link.repository';

export const TEST_BASE_TIME = new Date('2026-09-16T12:00:00.000Z');
export const TEST_EXPIRES_AT = new Date('2026-09-16T12:15:00.000Z');

export function dummyTokenHash(char: string): string {
  return char.repeat(64).slice(0, 64);
}

export async function claimInTx(
  prisma: PrismaClient,
  repo: PendingProviderLinkRepository,
  id: number,
  hash: string,
  now: Date,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => repo.claim(id, hash, now, tx));
}

export async function issueLink(
  repo: PendingProviderLinkRepository,
  userId: number,
  providerAccountId: string,
  char: string,
  expiresAt: Date = TEST_EXPIRES_AT,
  now: Date = TEST_BASE_TIME,
) {
  return repo.issue({
    userId,
    provider: 'google',
    providerAccountId,
    tokenHash: dummyTokenHash(char),
    expiresAt,
    now,
  });
}

export async function insertPendingLink(
  prisma: PrismaClient,
  userId: number,
  providerAccountId: string,
  tokenHash: string,
  expiresAt: Date = TEST_EXPIRES_AT,
  createdAt: Date = TEST_BASE_TIME,
  provider = 'google',
) {
  return prisma.pendingAuthProviderLink.create({
    data: {
      userId,
      provider,
      providerAccountId,
      tokenHash,
      expiresAt,
      createdAt,
    },
  });
}

export async function seedExpiredPendingLinks(
  prisma: PrismaClient,
  userId: number,
  now: Date = TEST_BASE_TIME,
) {
  await prisma.pendingAuthProviderLink.createMany({
    data: [
      {
        userId,
        provider: 'google',
        providerAccountId: 'sub-exp-1',
        tokenHash: dummyTokenHash('1'),
        expiresAt: new Date('2026-09-16T11:00:00.000Z'),
        createdAt: now,
      },
      {
        userId,
        provider: 'github',
        providerAccountId: 'sub-exp-2',
        tokenHash: dummyTokenHash('2'),
        expiresAt: new Date('2026-09-16T11:30:00.000Z'),
        createdAt: now,
      },
    ],
  });
}

import { Prisma } from '../../../generated/prisma/client';
import {
  IssuePendingProviderLinkInput,
  PendingProviderLinkRow,
} from '../interfaces/pending-provider-link.interface';

export function createMockPendingPrisma() {
  return {
    pendingAuthProviderLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

export type MockPendingPrisma = ReturnType<typeof createMockPendingPrisma>;

export const BASE_TEST_DATE = new Date('2026-09-16T12:00:00.000Z');

export const P2002_ERROR = new Prisma.PrismaClientKnownRequestError(
  'Unique constraint failed',
  { code: 'P2002', clientVersion: '7.2.0' },
);

export function fakePendingRow(
  overrides: Partial<PendingProviderLinkRow> = {},
): PendingProviderLinkRow {
  return {
    id: 1,
    userId: 10,
    provider: 'google',
    providerAccountId: 'sub-1',
    tokenHash: 'hash-1',
    expiresAt: new Date('2026-09-16T12:15:00Z'),
    createdAt: BASE_TEST_DATE,
    ...overrides,
  };
}

export function fakeIssueInput(
  overrides: Partial<IssuePendingProviderLinkInput> = {},
): IssuePendingProviderLinkInput {
  return {
    userId: 10,
    provider: 'google',
    providerAccountId: 'sub-1',
    tokenHash: 'hash-1',
    expiresAt: new Date('2026-09-16T12:15:00Z'),
    ...overrides,
  };
}

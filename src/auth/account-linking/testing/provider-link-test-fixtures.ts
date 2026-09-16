import { I18nService } from 'nestjs-i18n';
import { CustomLoggerService } from '../../../logger/logger.service';
import { EmailQueueProducer } from '../../../email/email-queue.producer';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthProviderRepository } from '../../account/auth-provider.repository';
import { PendingProviderLinkRepository } from '../pending-provider-link.repository';
import { ProviderLinkService } from '../provider-link.service';
import { ProviderLinkTokenService } from '../provider-link-token.service';

import { P2002_ERROR } from './pending-link-test-fixtures';

export const createMockPrisma = (txClient?: unknown) => ({
  $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback(txClient ?? {}),
  ),
});

export const createMockPendingRepo = () => ({
  issue: jest.fn(),
  findValid: jest.fn(),
  deleteIfCurrent: jest.fn(),
  claim: jest.fn(),
  deleteExpired: jest.fn(),
});

export const createMockAuthProviderRepo = () => ({
  findAccountByProvider: jest.fn(),
  create: jest.fn(),
});

export const createMockTokenService = () => ({
  issue: jest.fn().mockReturnValue({
    rawToken: 'mock-raw-token-43-chars-base64url-example',
    tokenHash:
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  }),
  hash: jest
    .fn()
    .mockReturnValue(
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    ),
});

export const createMockEmailQueue = () => ({
  enqueueProviderLinkConfirmation: jest.fn().mockResolvedValue(undefined),
});

export const createMockLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
});

export const createMockI18n = () => ({
  t: jest.fn((key: string) => key),
});

export const setupTestMocks = () => ({
  prisma: createMockPrisma(),
  pendingRepo: createMockPendingRepo(),
  authProviders: createMockAuthProviderRepo(),
  tokenService: createMockTokenService(),
  emailQueue: createMockEmailQueue(),
  logger: createMockLogger(),
  i18n: createMockI18n(),
});

export const createTestProviderLinkService = (
  mocks: ReturnType<typeof setupTestMocks>,
) =>
  new ProviderLinkService(
    mocks.prisma as unknown as PrismaService,
    mocks.pendingRepo as unknown as PendingProviderLinkRepository,
    mocks.authProviders as unknown as AuthProviderRepository,
    mocks.tokenService as unknown as ProviderLinkTokenService,
    mocks.emailQueue as unknown as EmailQueueProducer,
    mocks.logger as unknown as CustomLoggerService,
    mocks.i18n as unknown as I18nService,
  );

export const MOCK_LINK_REQUEST = {
  userId: 7,
  recipient: 'jane@example.com',
  provider: 'google',
  providerAccountId: 'google-sub-1',
};

export const MOCK_RAW_TOKEN = 'mock-raw-token-43-chars-base64url-example';
export const MOCK_TOKEN_HASH =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

export const createPendingRowFixture = () => ({
  id: 10,
  userId: 7,
  provider: 'google',
  providerAccountId: 'google-sub-1',
  tokenHash: MOCK_TOKEN_HASH,
  expiresAt: new Date(Date.now() + 600_000),
  createdAt: new Date(),
});

export const mockIssuedPending = (
  repo: ReturnType<typeof createMockPendingRepo>,
  pendingId = 42,
) =>
  repo.issue.mockResolvedValue({
    kind: 'issued',
    pendingId,
    tokenHash: MOCK_TOKEN_HASH,
    expiresAt: new Date(Date.now() + 900_000),
  });

export const mockValidPendingClaim = (
  mocks: ReturnType<typeof setupTestMocks>,
  pending = createPendingRowFixture(),
) => {
  mocks.pendingRepo.findValid.mockResolvedValue(pending);
  mocks.pendingRepo.claim.mockResolvedValue(true);
};

export const mockEnqueueFailure = (
  mocks: ReturnType<typeof setupTestMocks>,
  dbError?: Error,
) => {
  mockIssuedPending(mocks.pendingRepo);
  mocks.emailQueue.enqueueProviderLinkConfirmation.mockRejectedValue(
    new Error(
      `Queue rejected ${MOCK_LINK_REQUEST.recipient} token ${MOCK_RAW_TOKEN}`,
    ),
  );
  if (dbError) {
    mocks.pendingRepo.deleteIfCurrent.mockRejectedValue(dbError);
  } else {
    mocks.pendingRepo.deleteIfCurrent.mockResolvedValue(true);
  }
};

export const mockProviderCreateRace = (
  mocks: ReturnType<typeof setupTestMocks>,
  account: { id: number },
) => {
  mockValidPendingClaim(mocks);
  mocks.authProviders.findAccountByProvider
    .mockResolvedValueOnce(null)
    .mockImplementationOnce((_identity: unknown, client?: unknown) => {
      if (client) {
        throw new Error('current transaction is aborted');
      }
      return account;
    });
  mocks.authProviders.create.mockRejectedValue(P2002_ERROR);
};

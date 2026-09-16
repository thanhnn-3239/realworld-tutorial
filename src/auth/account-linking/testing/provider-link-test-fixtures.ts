import { ProviderLinkService } from '../provider-link.service';

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
    mocks.prisma as any,
    mocks.pendingRepo as any,
    mocks.authProviders as any,
    mocks.tokenService as any,
    mocks.emailQueue as any,
    mocks.logger as any,
    mocks.i18n as any,
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

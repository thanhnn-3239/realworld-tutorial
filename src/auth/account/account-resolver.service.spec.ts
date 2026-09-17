import { ConflictException } from '@nestjs/common';
import { ProviderLinkService } from '../account-linking/provider-link.service';
import { VerifiedIdentity } from '../providers/verified-identity.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountResolverService } from './account-resolver.service';
import { AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';

const IDENTITY: VerifiedIdentity = {
  provider: 'google',
  providerAccountId: '109384572934857293845',
  email: 'jane@example.com',
  emailVerified: true,
  displayName: 'Jane Doe',
};

const ACCOUNT = {
  id: 7,
  email: IDENTITY.email,
  username: 'jane',
  bio: null,
  image: null,
};

describe('AccountResolverService', () => {
  const tx = { __brand: 'tx' };
  let service: AccountResolverService;
  let prisma: { $transaction: jest.Mock };
  let accountUsers: {
    findIdByEmail: jest.Mock;
    createPasswordless: jest.Mock;
  };
  let providers: { findAccountByProvider: jest.Mock; create: jest.Mock };
  let providerLinks: { requestLink: jest.Mock };

  beforeEach(() => {
    accountUsers = {
      findIdByEmail: jest.fn().mockResolvedValue(null),
      createPasswordless: jest.fn().mockResolvedValue(ACCOUNT),
    };
    providers = {
      findAccountByProvider: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    providerLinks = {
      requestLink: jest
        .fn()
        .mockResolvedValue({ kind: 'issued', pendingId: 11 }),
    };
    prisma = {
      $transaction: jest.fn((fn: (client: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    service = new AccountResolverService(
      prisma as unknown as PrismaService,
      accountUsers as unknown as AccountUserRepository,
      providers as unknown as AuthProviderRepository,
      providerLinks as unknown as ProviderLinkService,
    );
  });

  it('returns an already-linked provider account without other lookups', async () => {
    providers.findAccountByProvider.mockResolvedValue(ACCOUNT);

    await expect(service.resolve(IDENTITY)).resolves.toEqual({
      kind: 'account',
      account: ACCOUNT,
    });

    expect(accountUsers.findIdByEmail).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(providerLinks.requestLink).not.toHaveBeenCalled();
  });

  it('requests confirmation for an existing verified email without mutation', async () => {
    accountUsers.findIdByEmail.mockResolvedValue(7);

    await expect(service.resolve(IDENTITY)).resolves.toEqual({
      kind: 'confirmation-required',
    });

    expect(providerLinks.requestLink).toHaveBeenCalledWith({
      userId: 7,
      recipient: IDENTITY.email,
      provider: IDENTITY.provider,
      providerAccountId: IDENTITY.providerAccountId,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(providers.create).not.toHaveBeenCalled();
  });

  it('refuses an unverified existing email without requesting confirmation', async () => {
    accountUsers.findIdByEmail.mockResolvedValue(7);

    await expect(
      service.resolve({ ...IDENTITY, emailVerified: false }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(providers.create).not.toHaveBeenCalled();
    expect(providerLinks.requestLink).not.toHaveBeenCalled();
  });

  it('creates and links a new passwordless account in one transaction', async () => {
    await expect(service.resolve(IDENTITY)).resolves.toEqual({
      kind: 'account',
      account: ACCOUNT,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(accountUsers.createPasswordless).toHaveBeenCalledWith(
      IDENTITY.email,
      expect.stringMatching(/^jane_[0-9]+_[0-9a-f]{4}$/),
      tx,
    );
    expect(providers.create).toHaveBeenCalledWith(7, IDENTITY, tx);
    expect(providerLinks.requestLink).not.toHaveBeenCalled();
  });
});

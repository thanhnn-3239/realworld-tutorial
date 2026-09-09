import { ConflictException } from '@nestjs/common';
import { AccountResolverService } from './account-resolver.service';
import { AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRepository } from '../token/refresh-token.repository';
import { VerifiedIdentity } from '../providers/verified-identity.interface';

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
  let service: AccountResolverService;
  const tx = { __brand: 'tx' };
  let prisma: {
    $transaction: jest.Mock;
  };
  let accountUsers: {
    findIdByEmail: jest.Mock;
    createPasswordless: jest.Mock;
    clearPassword: jest.Mock;
  };
  let providers: { findAccountByProvider: jest.Mock; create: jest.Mock };
  let refreshTokens: { revokeAllForUser: jest.Mock };

  beforeEach(() => {
    accountUsers = {
      findIdByEmail: jest.fn().mockResolvedValue(null),
      createPasswordless: jest.fn().mockResolvedValue(ACCOUNT),
      clearPassword: jest.fn().mockResolvedValue(ACCOUNT),
    };
    providers = {
      findAccountByProvider: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    refreshTokens = {
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
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
      refreshTokens as unknown as RefreshTokenRepository,
    );
  });

  describe('case 1 — the provider account is already linked', () => {
    it('loads that user directly in one query and skips transaction', async () => {
      providers.findAccountByProvider.mockResolvedValue(ACCOUNT);

      await expect(service.resolve(IDENTITY)).resolves.toEqual(ACCOUNT);

      expect(providers.findAccountByProvider).toHaveBeenCalledWith(IDENTITY);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(accountUsers.findIdByEmail).not.toHaveBeenCalled();
      expect(providers.create).not.toHaveBeenCalled();
      expect(accountUsers.createPasswordless).not.toHaveBeenCalled();
      expect(accountUsers.clearPassword).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('case 2 — the email already has an account', () => {
    beforeEach(() => {
      accountUsers.findIdByEmail.mockResolvedValue(7);
    });

    it('links, clears the password and revokes sessions inside transaction', async () => {
      await expect(service.resolve(IDENTITY)).resolves.toEqual(ACCOUNT);

      expect(accountUsers.findIdByEmail).toHaveBeenCalledWith(IDENTITY.email);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(providers.create).toHaveBeenCalledWith(7, IDENTITY, tx);
      expect(accountUsers.clearPassword).toHaveBeenCalledWith(7, tx);
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(7, tx);
    });

    it('refuses when the provider did not verify the address without starting transaction', async () => {
      await expect(
        service.resolve({ ...IDENTITY, emailVerified: false }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(providers.create).not.toHaveBeenCalled();
      expect(accountUsers.clearPassword).not.toHaveBeenCalled();
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('case 3 — nothing exists yet', () => {
    it('creates a passwordless user and links inside a transaction with generated unique username', async () => {
      await service.resolve(IDENTITY);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(accountUsers.createPasswordless).toHaveBeenCalledWith(
        IDENTITY.email,
        expect.stringMatching(/^jane_[0-9]+_[0-9a-f]{4}$/),
        tx,
      );
      expect(providers.create).toHaveBeenCalledWith(7, IDENTITY, tx);
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});

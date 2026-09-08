import { ConflictException } from '@nestjs/common';
import { AccountResolverService } from './account-resolver.service';
import { AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../token/token.service';
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
  // Stands in for the transaction client. Its identity is what the assertions check: every
  // repository call must receive this exact object, or the work is not in the transaction.
  const tx = { __brand: 'tx' };
  let accountUsers: {
    findIdByEmail: jest.Mock;
    findAccountById: jest.Mock;
    isUsernameTaken: jest.Mock;
    createPasswordless: jest.Mock;
    clearPassword: jest.Mock;
  };
  let providers: { findUserIdByAccount: jest.Mock; link: jest.Mock };
  let tokenService: { revokeAllForUser: jest.Mock };

  beforeEach(() => {
    accountUsers = {
      findIdByEmail: jest.fn().mockResolvedValue(null),
      findAccountById: jest.fn().mockResolvedValue(ACCOUNT),
      isUsernameTaken: jest.fn().mockResolvedValue(false),
      createPasswordless: jest.fn().mockResolvedValue(ACCOUNT),
      clearPassword: jest.fn().mockResolvedValue(ACCOUNT),
    };
    providers = {
      findUserIdByAccount: jest.fn().mockResolvedValue(null),
      link: jest.fn().mockResolvedValue(undefined),
    };
    tokenService = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };

    // Runs the callback against the stand-in client, which is what `$transaction` does.
    const prisma = {
      $transaction: (fn: (client: unknown) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaService;

    service = new AccountResolverService(
      prisma,
      accountUsers as unknown as AccountUserRepository,
      providers as unknown as AuthProviderRepository,
      tokenService as unknown as TokenService,
    );
  });

  describe('case 1 — the provider account is already linked', () => {
    it('loads that user and changes nothing', async () => {
      providers.findUserIdByAccount.mockResolvedValue(7);

      await expect(service.resolve(IDENTITY)).resolves.toEqual(ACCOUNT);

      expect(accountUsers.findAccountById).toHaveBeenCalledWith(tx, 7);
      expect(providers.link).not.toHaveBeenCalled();
      expect(accountUsers.createPasswordless).not.toHaveBeenCalled();
      expect(accountUsers.clearPassword).not.toHaveBeenCalled();
      expect(tokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('refuses when the link points at a user that is gone', async () => {
      providers.findUserIdByAccount.mockResolvedValue(7);
      accountUsers.findAccountById.mockResolvedValue(null);

      await expect(service.resolve(IDENTITY)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('case 2 — the email already has an account', () => {
    beforeEach(() => {
      accountUsers.findIdByEmail.mockResolvedValue(7);
    });

    it('links, clears the password and revokes every session inside the transaction', async () => {
      await expect(service.resolve(IDENTITY)).resolves.toEqual(ACCOUNT);

      expect(providers.link).toHaveBeenCalledWith(
        tx,
        7,
        IDENTITY.provider,
        IDENTITY.providerAccountId,
      );
      expect(accountUsers.clearPassword).toHaveBeenCalledWith(tx, 7);
      // Passing `tx` is what makes the clearing and the revocation atomic.
      expect(tokenService.revokeAllForUser).toHaveBeenCalledWith(7, tx);
    });

    it('refuses when the provider did not verify the address', async () => {
      await expect(
        service.resolve({ ...IDENTITY, emailVerified: false }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(providers.link).not.toHaveBeenCalled();
      expect(accountUsers.clearPassword).not.toHaveBeenCalled();
      expect(tokenService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('case 3 — nothing exists yet', () => {
    it('creates a passwordless user with a derived username, then links it', async () => {
      await service.resolve(IDENTITY);

      expect(accountUsers.createPasswordless).toHaveBeenCalledWith(
        tx,
        IDENTITY.email,
        'jane',
      );
      expect(providers.link).toHaveBeenCalledWith(
        tx,
        7,
        IDENTITY.provider,
        IDENTITY.providerAccountId,
      );
      expect(tokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('skips usernames that are already taken', async () => {
      const taken = new Set(['jane', 'jane2']);
      accountUsers.isUsernameTaken.mockImplementation(
        (_tx: unknown, username: string) => Promise.resolve(taken.has(username)),
      );

      await service.resolve(IDENTITY);

      expect(accountUsers.createPasswordless).toHaveBeenCalledWith(
        tx,
        IDENTITY.email,
        'jane3',
      );
    });

    it('gives up with a conflict when every candidate is taken', async () => {
      accountUsers.isUsernameTaken.mockResolvedValue(true);

      await expect(service.resolve(IDENTITY)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(accountUsers.createPasswordless).not.toHaveBeenCalled();
    });
  });
});

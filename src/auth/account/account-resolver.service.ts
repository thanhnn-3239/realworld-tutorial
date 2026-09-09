import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenRepository } from '../token/refresh-token.repository';
import { VerifiedIdentity } from '../providers/verified-identity.interface';
import { AccountRow, AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';
import { generateUsername } from './username-generator';

export type ResolvedAccount = AccountRow;

@Injectable()
export class AccountResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountUsers: AccountUserRepository,
    private readonly authProviders: AuthProviderRepository,
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async resolve(identity: VerifiedIdentity): Promise<ResolvedAccount> {
    const linkedAccount =
      await this.authProviders.findAccountByProvider(identity);

    if (linkedAccount !== null) {
      return linkedAccount;
    }

    const existingAccountUserId = await this.accountUsers.findIdByEmail(
      identity.email,
    );

    if (existingAccountUserId !== null) {
      return this.linkToExisting(existingAccountUserId, identity);
    }

    return this.createAccount(identity);
  }

  private async linkToExisting(
    userId: number,
    identity: VerifiedIdentity,
  ): Promise<ResolvedAccount> {
    if (!identity.emailVerified) {
      throw new ConflictException(
        'Sign in with your password first, then link this provider',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.authProviders.create(userId, identity, tx);

      const account = await this.accountUsers.clearPassword(userId, tx);
      await this.refreshTokens.revokeAllForUser(userId, tx);

      return account;
    });
  }

  private async createAccount(
    identity: VerifiedIdentity,
  ): Promise<ResolvedAccount> {
    const username = generateUsername(identity.email);

    return this.prisma.$transaction(async (tx) => {
      const account = await this.accountUsers.createPasswordless(
        identity.email,
        username,
        tx,
      );

      await this.authProviders.create(account.id, identity, tx);

      return account;
    });
  }
}

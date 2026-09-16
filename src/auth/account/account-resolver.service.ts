import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderLinkService } from '../account-linking/provider-link.service';
import { VerifiedIdentity } from '../providers/verified-identity.interface';
import { AccountRow, AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';
import { AccountResolution } from './interfaces/account-resolution.interface';
import { generateUsername } from './username-generator';

@Injectable()
export class AccountResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountUsers: AccountUserRepository,
    private readonly authProviders: AuthProviderRepository,
    private readonly providerLinks: ProviderLinkService,
  ) {}

  async resolve(identity: VerifiedIdentity): Promise<AccountResolution> {
    const linkedAccount =
      await this.authProviders.findAccountByProvider(identity);

    if (linkedAccount !== null) {
      return { kind: 'account', account: linkedAccount };
    }

    const existingAccountUserId = await this.accountUsers.findIdByEmail(
      identity.email,
    );

    if (existingAccountUserId !== null) {
      return this.linkToExisting(existingAccountUserId, identity);
    }

    const account = await this.createAccount(identity);
    return { kind: 'account', account };
  }

  private async linkToExisting(
    userId: number,
    identity: VerifiedIdentity,
  ): Promise<AccountResolution> {
    if (!identity.emailVerified) {
      throw new ConflictException(
        'Sign in with your password first, then link this provider',
      );
    }

    await this.providerLinks.requestLink({
      userId,
      recipient: identity.email,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
    });

    return { kind: 'confirmation-required' };
  }

  private async createAccount(identity: VerifiedIdentity): Promise<AccountRow> {
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

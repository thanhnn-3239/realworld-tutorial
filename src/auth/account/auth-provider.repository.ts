import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCOUNT_SELECT, AccountRow } from './account-user.repository';

export interface ProviderIdentifier {
  provider: string;
  providerAccountId: string;
}

@Injectable()
export class AuthProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountByProvider(
    identifier: ProviderIdentifier,
  ): Promise<AccountRow | null> {
    const link = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identifier.provider,
          providerAccountId: identifier.providerAccountId,
        },
      },
      select: {
        user: { select: ACCOUNT_SELECT },
      },
    });

    return link?.user ?? null;
  }

  async create(
    userId: number,
    identity: ProviderIdentifier,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.authProvider.create({
      data: {
        userId,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
      },
    });
  }
}

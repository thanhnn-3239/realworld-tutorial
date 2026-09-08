import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

/**
 * Every method takes the transaction client rather than holding its own: resolution is only
 * correct as one atomic unit, so this layer must never open a connection of its own.
 */
@Injectable()
export class AuthProviderRepository {
  async findUserIdByAccount(
    tx: Prisma.TransactionClient,
    provider: string,
    providerAccountId: string,
  ): Promise<number | null> {
    const link = await tx.authProvider.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
      select: { userId: true },
    });

    return link?.userId ?? null;
  }

  async link(
    tx: Prisma.TransactionClient,
    userId: number,
    provider: string,
    providerAccountId: string,
  ): Promise<void> {
    await tx.authProvider.create({
      data: { userId, provider, providerAccountId },
    });
  }
}

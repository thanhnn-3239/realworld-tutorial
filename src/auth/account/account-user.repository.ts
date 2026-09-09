import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const ACCOUNT_SELECT = {
  id: true,
  email: true,
  username: true,
  bio: true,
  image: true,
} as const satisfies Prisma.UserSelect;

export type AccountRow = Prisma.UserGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;

/**
 * User-row access for account resolution.
 */
@Injectable()
export class AccountUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findIdByEmail(email: string): Promise<number | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  async createPasswordless(
    email: string,
    username: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<AccountRow> {
    return client.user.create({
      data: { email, username, password: null },
      select: ACCOUNT_SELECT,
    });
  }

  /** Used by the provider-link path to evict a password nobody proved they owned. */
  async clearPassword(
    id: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<AccountRow> {
    return client.user.update({
      where: { id },
      data: { password: null },
      select: ACCOUNT_SELECT,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

export interface AccountRow {
  id: number;
  email: string;
  username: string;
  bio: string | null;
  image: string | null;
}

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  username: true,
  bio: true,
  image: true,
} as const;

/**
 * User-row access for account resolution. Separate from `UsersRepository`, which belongs to
 * `UsersModule` and opens its own connection: every method here takes the transaction client,
 * because resolution is only correct as one atomic unit.
 */
@Injectable()
export class AccountUserRepository {
  async findIdByEmail(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<number | null> {
    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return user?.id ?? null;
  }

  async findAccountById(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<AccountRow | null> {
    return tx.user.findUnique({ where: { id }, select: ACCOUNT_SELECT });
  }

  async isUsernameTaken(
    tx: Prisma.TransactionClient,
    username: string,
  ): Promise<boolean> {
    const existing = await tx.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return existing !== null;
  }

  async createPasswordless(
    tx: Prisma.TransactionClient,
    email: string,
    username: string,
  ): Promise<AccountRow> {
    return tx.user.create({
      data: { email, username, password: null },
      select: ACCOUNT_SELECT,
    });
  }

  /** Used by the provider-link path to evict a password nobody proved they owned. */
  async clearPassword(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<AccountRow> {
    return tx.user.update({
      where: { id },
      data: { password: null },
      select: ACCOUNT_SELECT,
    });
  }
}

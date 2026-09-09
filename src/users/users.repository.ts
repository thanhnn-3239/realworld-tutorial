import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.publicUserSelect(),
    });
  }

  /**
   * `client` lets the caller commit this update together with the rows it
   * writes next. The conflict lookups below deliberately take none: they run
   * before a transaction opens, so a rejected request never reaches storage,
   * and giving them one would only lengthen the lock window.
   */
  async update(
    id: number,
    data: Prisma.UserUpdateInput,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    return client.user.update({
      where: { id },
      data,
      select: this.publicUserSelect(),
    });
  }

  /**
   * Raw SQL because Prisma exposes no `FOR UPDATE`, and the row lock is the
   * whole mechanism: it serialises concurrent avatar replacements so the
   * second one observes the key the first committed, rather than the key both
   * started from. Without the lock the loser's object is never reclaimed.
   */
  async lockImage(
    id: number,
    client: Prisma.TransactionClient,
  ): Promise<string | null> {
    const rows = await client.$queryRaw<
      { image: string | null }[]
    >`SELECT "image" FROM "User" WHERE "id" = ${id} FOR UPDATE`;

    return rows[0]?.image ?? null;
  }

  async findByUsernameExcluding(username: string, excludeId: number) {
    return this.prisma.user.findFirst({
      where: {
        username,
        NOT: { id: excludeId },
      },
      select: { id: true },
    });
  }

  private publicUserSelect(): Prisma.UserSelect {
    return {
      id: true,
      email: true,
      username: true,
      bio: true,
      image: true,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Deliberately excludes `tokenHash`: callers already hold the raw token they hashed to get
 * here, and handing the stored hash back out serves nobody.
 */
export interface RefreshTokenRow {
  id: number;
  userId: number;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: number | null;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshTokenRow> {
    return this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
      select: this.rowSelect,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: this.rowSelect,
    });
  }

  async markReplaced(id: number, replacedById: number): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { replacedById },
    });
  }

  async revokeById(id: number): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Scoped to still-live rows so an already-revoked row keeps its original timestamp.
   *
   * Takes an optional client so a caller already inside `$transaction` can make the
   * revocation part of that transaction — account linking needs the password clearing and
   * this revocation to commit together or not at all.
   */
  async revokeAllForUser(
    userId: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(now: Date): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  private readonly rowSelect = {
    id: true,
    userId: true,
    expiresAt: true,
    revokedAt: true,
    replacedById: true,
  } as const;
}

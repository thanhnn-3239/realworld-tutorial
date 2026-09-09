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
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<RefreshTokenRow> {
    return client.refreshToken.create({
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

  async markAsUsed(
    id: number,
    replacedById: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const result = await client.refreshToken.updateMany({
      where: { id, replacedById: null },
      data: { replacedById },
    });

    return result.count > 0;
  }

  async revokeById(id: number): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

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

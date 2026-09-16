import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PENDING_LINK_RESEND_COOLDOWN_MS } from './constants/pending-provider-link.constants';
import {
  IssuePendingProviderLinkInput,
  PendingIssueResult,
  PendingProviderLinkRow,
} from './interfaces/pending-provider-link.interface';

@Injectable()
export class PendingProviderLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    input: IssuePendingProviderLinkInput,
  ): Promise<PendingIssueResult> {
    const now = input.now ?? new Date();
    const existing = await this.findExisting(input);

    if (existing) {
      const elapsedMs = now.getTime() - existing.createdAt.getTime();
      if (elapsedMs < PENDING_LINK_RESEND_COOLDOWN_MS) {
        return { kind: 'cooldown', pendingId: existing.id };
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const client = tx as Prisma.TransactionClient;
        await client.pendingAuthProviderLink.deleteMany({
          where: {
            OR: [
              {
                provider: input.provider,
                providerAccountId: input.providerAccountId,
              },
              { userId: input.userId, provider: input.provider },
            ],
          },
        });

        const created = await client.pendingAuthProviderLink.create({
          data: {
            userId: input.userId,
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
            createdAt: now,
          },
        });

        return {
          kind: 'issued',
          pendingId: created.id,
          tokenHash: created.tokenHash,
          expiresAt: created.expiresAt,
        };
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const conflict = await this.findExisting(input);
        if (conflict) {
          return { kind: 'cooldown', pendingId: conflict.id };
        }
      }
      throw error;
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  async findValid(
    tokenHash: string,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PendingProviderLinkRow | null> {
    return client.pendingAuthProviderLink.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: now },
      },
    });
  }

  async deleteIfCurrent(
    id: number,
    tokenHash: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const result = await client.pendingAuthProviderLink.deleteMany({
      where: {
        id,
        tokenHash,
      },
    });

    return result.count === 1;
  }

  async claim(
    id: number,
    tokenHash: string,
    now: Date,
    client: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await client.pendingAuthProviderLink.deleteMany({
      where: {
        id,
        tokenHash,
        expiresAt: { gt: now },
      },
    });

    return result.count === 1;
  }

  async deleteExpired(
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.pendingAuthProviderLink.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    return result.count;
  }

  private findExisting(input: IssuePendingProviderLinkInput) {
    return this.prisma.pendingAuthProviderLink.findFirst({
      where: {
        OR: [
          {
            provider: input.provider,
            providerAccountId: input.providerAccountId,
          },
          { userId: input.userId, provider: input.provider },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

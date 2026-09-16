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
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PendingIssueResult> {
    const now = input.now ?? new Date();

    const existing = await client.pendingAuthProviderLink.findFirst({
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

    if (existing) {
      return this.handleExistingOrConflict(existing, input, now, client);
    }

    try {
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
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        const conflict = await client.pendingAuthProviderLink.findFirst({
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

        if (conflict) {
          return this.handleExistingOrConflict(conflict, input, now, client);
        }
      }

      throw error;
    }
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

  private async handleExistingOrConflict(
    existing: PendingProviderLinkRow,
    input: IssuePendingProviderLinkInput,
    now: Date,
    client: Prisma.TransactionClient,
  ): Promise<PendingIssueResult> {
    const elapsedMs = now.getTime() - existing.createdAt.getTime();
    if (elapsedMs < PENDING_LINK_RESEND_COOLDOWN_MS) {
      return { kind: 'cooldown', pendingId: existing.id };
    }

    const updated = await client.pendingAuthProviderLink.update({
      where: { id: existing.id },
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
      pendingId: updated.id,
      tokenHash: updated.tokenHash,
      expiresAt: updated.expiresAt,
    };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

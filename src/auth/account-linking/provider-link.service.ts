import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomLoggerService } from '../../logger/logger.service';
import { EmailQueueProducer } from '../../email/email-queue.producer';
import { AuthProviderRepository } from '../account/auth-provider.repository';
import {
  LINK_TTL_MS,
  TOKEN_HASH_PREFIX_LENGTH,
} from './constants/pending-provider-link.constants';
import { ProviderLinkRequest } from './interfaces/provider-link-request.interface';
import { ProviderLinkRequestResult } from './interfaces/provider-link-request-result.interface';
import { ProviderLinkConfirmationResult } from './interfaces/provider-link-confirmation-result.interface';
import { PendingProviderLinkRepository } from './pending-provider-link.repository';
import { ProviderLinkTokenService } from './provider-link-token.service';

@Injectable()
export class ProviderLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pendingRepo: PendingProviderLinkRepository,
    private readonly authProviders: AuthProviderRepository,
    private readonly tokenService: ProviderLinkTokenService,
    private readonly emailQueue: EmailQueueProducer,
    private readonly logger: CustomLoggerService,
    private readonly i18n: I18nService,
  ) {
    this.logger.setContext(ProviderLinkService.name);
  }

  async requestLink(
    input: ProviderLinkRequest,
  ): Promise<ProviderLinkRequestResult> {
    const { rawToken, tokenHash } = this.tokenService.issue();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);

    const issueResult = await this.pendingRepo.issue({
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      tokenHash,
      expiresAt,
      now,
    });

    if (issueResult.kind === 'cooldown') {
      return { kind: 'cooldown', pendingId: issueResult.pendingId };
    }

    const tokenHashPrefix = tokenHash.slice(0, TOKEN_HASH_PREFIX_LENGTH);

    try {
      await this.emailQueue.enqueueProviderLinkConfirmation({
        job: {
          pendingId: issueResult.pendingId,
          recipient: input.recipient,
          rawToken,
          expiresAt: expiresAt.toISOString(),
        },
        tokenHashPrefix,
      });

      return { kind: 'issued', pendingId: issueResult.pendingId };
    } catch {
      this.logger.error(
        `Failed to enqueue provider link email for pendingId: ${issueResult.pendingId}`,
      );

      try {
        await this.pendingRepo.deleteIfCurrent(
          issueResult.pendingId,
          tokenHash,
        );
      } catch {
        this.logger.error(
          `Compensation delete failed for pendingId: ${issueResult.pendingId}`,
        );
      }

      throw new ServiceUnavailableException(
        'Service unavailable, please try again later',
      );
    }
  }

  async confirm(rawToken: string): Promise<ProviderLinkConfirmationResult> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException(
        this.i18n.t('common.error.invalidOrExpiredLinkToken'),
      );
    }

    const tokenHash = this.tokenService.hash(rawToken);
    const now = new Date();
    let racedIdentity:
      | {
          userId: number;
          provider: string;
          providerAccountId: string;
        }
      | undefined;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const pending = await this.pendingRepo.findValid(tokenHash, now, tx);
        if (!pending) {
          throw new BadRequestException(
            this.i18n.t('common.error.invalidOrExpiredLinkToken'),
          );
        }

        const claimed = await this.pendingRepo.claim(
          pending.id,
          tokenHash,
          now,
          tx,
        );

        const identity = {
          provider: pending.provider,
          providerAccountId: pending.providerAccountId,
        };

        const existingAccount = await this.authProviders.findAccountByProvider(
          identity,
          tx,
        );

        if (existingAccount) {
          if (existingAccount.id === pending.userId) {
            return { kind: 'already-confirmed' };
          }
          throw new ConflictException(
            this.i18n.t('common.error.providerLinkConflict'),
          );
        }

        if (!claimed) {
          throw new BadRequestException(
            this.i18n.t('common.error.invalidOrExpiredLinkToken'),
          );
        }

        racedIdentity = { userId: pending.userId, ...identity };
        await this.authProviders.create(pending.userId, identity, tx);
        return { kind: 'confirmed' };
      });
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error) || !racedIdentity) {
        throw error;
      }

      const { userId, ...identity } = racedIdentity;
      const conflict = await this.authProviders.findAccountByProvider(identity);
      if (conflict?.id === userId) {
        return { kind: 'already-confirmed' };
      }
      throw new ConflictException(
        this.i18n.t('common.error.providerLinkConflict'),
      );
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

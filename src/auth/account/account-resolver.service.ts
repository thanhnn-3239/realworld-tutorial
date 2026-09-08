import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { VerifiedIdentity } from '../providers/verified-identity.interface';
import { AccountRow, AccountUserRepository } from './account-user.repository';
import { AuthProviderRepository } from './auth-provider.repository';
import {
  baseUsernameFromEmail,
  MAX_NUMBERED_ATTEMPTS,
  usernameCandidate,
} from './username-generator';

export type ResolvedAccount = AccountRow;

const MAX_USERNAME_ATTEMPTS = MAX_NUMBERED_ATTEMPTS + 1;
const MAX_TRANSACTION_ATTEMPTS = 3;

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION_CODE = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION_CODE
  );
}

@Injectable()
export class AccountResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountUsers: AccountUserRepository,
    private readonly authProviders: AuthProviderRepository,
    private readonly tokenService: TokenService,
  ) {}

  async resolve(identity: VerifiedIdentity): Promise<ResolvedAccount> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.resolveOnce(identity);
      } catch (error) {
        // Two simultaneous first-time sign-ins sharing an email local-part can both pass the
        // availability check and then collide on the unique index. Retrying the whole
        // transaction is the only correct response: in PostgreSQL a failed statement aborts
        // the transaction, so nothing can be retried from inside it.
        //
        // Rethrown as-is on purpose: a Prisma error already carries the constraint and the
        // failing fields, which wrapping it would hide.
        if (!isUniqueViolation(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
          throw error;
        }
      }
    }

    throw new ConflictException('Could not resolve the account');
  }

  /** Owns the transaction boundary; all table access goes through the two repositories. */
  private resolveOnce(identity: VerifiedIdentity): Promise<ResolvedAccount> {
    return this.prisma.$transaction(async (tx) => {
      const linkedUserId = await this.authProviders.findUserIdByAccount(
        tx,
        identity.provider,
        identity.providerAccountId,
      );

      if (linkedUserId !== null) {
        return this.loadAccount(tx, linkedUserId);
      }

      const existingId = await this.accountUsers.findIdByEmail(
        tx,
        identity.email,
      );

      if (existingId !== null) {
        return this.linkToExisting(tx, existingId, identity);
      }

      return this.createAccount(tx, identity);
    });
  }

  private async loadAccount(
    tx: Prisma.TransactionClient,
    userId: number,
  ): Promise<ResolvedAccount> {
    const account = await this.accountUsers.findAccountById(tx, userId);

    if (!account) {
      // The link's foreign key cascades, so a link without its user should be impossible.
      throw new ConflictException('Linked account is missing');
    }

    return account;
  }

  private async linkToExisting(
    tx: Prisma.TransactionClient,
    userId: number,
    identity: VerifiedIdentity,
  ): Promise<ResolvedAccount> {
    if (!identity.emailVerified) {
      throw new ConflictException(
        'Sign in with your password first, then link this provider',
      );
    }

    await this.authProviders.link(
      tx,
      userId,
      identity.provider,
      identity.providerAccountId,
    );

    // Nothing verifies email ownership at registration, so this row may have been created by
    // someone who merely typed the address. Clearing the password and killing the sessions
    // evicts them at the moment the verified owner arrives.
    const account = await this.accountUsers.clearPassword(tx, userId);
    await this.tokenService.revokeAllForUser(userId, tx);

    return account;
  }

  private async createAccount(
    tx: Prisma.TransactionClient,
    identity: VerifiedIdentity,
  ): Promise<ResolvedAccount> {
    const username = await this.allocateUsername(tx, identity.email);
    const account = await this.accountUsers.createPasswordless(
      tx,
      identity.email,
      username,
    );

    await this.authProviders.link(
      tx,
      account.id,
      identity.provider,
      identity.providerAccountId,
    );

    return account;
  }

  /**
   * Probes with SELECTs rather than letting an INSERT fail: a unique violation would abort
   * the surrounding transaction, making every later statement in it unusable.
   */
  private async allocateUsername(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<string> {
    const base = baseUsernameFromEmail(email);

    for (let attempt = 1; attempt <= MAX_USERNAME_ATTEMPTS; attempt += 1) {
      const candidate = usernameCandidate(base, attempt);

      if (!(await this.accountUsers.isUsernameTaken(tx, candidate))) {
        return candidate;
      }
    }

    throw new ConflictException('Could not allocate a username');
  }
}

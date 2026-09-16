import type { Prisma } from '../../../generated/prisma/client';
import type { IssuePendingProviderLinkInput } from '../interfaces/pending-provider-link.interface';
import type { PendingProviderLinkRepository } from '../pending-provider-link.repository';

// Compile-only contract: issuance cannot recover P2002 inside an aborted transaction.
export function assertIssuanceContract(
  repository: PendingProviderLinkRepository,
  input: IssuePendingProviderLinkInput,
  transaction: Prisma.TransactionClient,
): void {
  // @ts-expect-error Issuance deliberately does not accept a transaction client.
  void repository.issue(input, transaction);
}

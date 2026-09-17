export type PendingIssueResult =
  | {
      kind: 'issued';
      pendingId: number;
      tokenHash: string;
      expiresAt: Date;
    }
  | { kind: 'cooldown'; pendingId: number };

export interface IssuePendingProviderLinkInput {
  userId: number;
  provider: string;
  providerAccountId: string;
  tokenHash: string;
  expiresAt: Date;
  now?: Date;
}

export interface PendingProviderLinkRow {
  id: number;
  userId: number;
  provider: string;
  providerAccountId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

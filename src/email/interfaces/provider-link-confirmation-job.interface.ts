export interface ProviderLinkConfirmationJob {
  pendingId: number;
  recipient: string;
  rawToken: string;
  expiresAt: string;
}

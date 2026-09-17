export type ProviderLinkRequestResult =
  | { kind: 'issued'; pendingId: number }
  | { kind: 'cooldown'; pendingId: number };

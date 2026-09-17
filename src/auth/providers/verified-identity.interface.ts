/**
 * The single contract between a provider and account resolution. A provider's job ends the
 * moment it produces one of these; nothing downstream knows which provider it came from
 * beyond the `provider` label.
 *
 * `email` is required, which is what makes a future phone-first provider a change to this
 * interface rather than a drop-in. Deliberate: guessing the second lookup key for a provider
 * that does not exist yet is the worse bet.
 */
export interface VerifiedIdentity {
  /** Matches the `provider` column, e.g. `'google'`. */
  provider: string;
  /** The provider's stable subject id — Google's `sub`. Never the email. */
  providerAccountId: string;
  email: string;
  /**
   * Whether the *provider* verified the address. Says nothing about whether our own row with
   * that address belongs to the same person, which is why linking clears the password.
   */
  emailVerified: boolean;
  displayName?: string;
}

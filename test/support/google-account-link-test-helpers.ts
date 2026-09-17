import { createHash } from 'node:crypto';
import type { E2eContext } from './e2e-suite';

export interface TestGoogleIdentity {
  readonly providerAccountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

let sequence = 0;
const runNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function googleIdentity(role: string): TestGoogleIdentity {
  sequence += 1;
  return {
    providerAccountId: `sub-${role}-${runNonce}-${sequence}`,
    email: `google-${role}-${runNonce}-${sequence}@example.test`,
    emailVerified: true,
  };
}

export function googleCallback(e2e: E2eContext, identity: TestGoogleIdentity) {
  return e2e.request
    .get('/v1/auth/google/callback')
    .set('x-test-google-sub', identity.providerAccountId)
    .set('x-test-google-email', identity.email)
    .set('x-test-google-email-verified', String(identity.emailVerified));
}

export function confirmationToken(text: string): string {
  const match = text.match(/https?:\/\/\S+/u);
  const token = match ? new URL(match[0]).searchParams.get('token') : null;
  if (!token) throw new Error('Confirmation email contains no token');
  return token;
}

export function validRawToken(character: string): string {
  return character.repeat(43).slice(0, 43);
}

export async function insertPendingToken(
  e2e: E2eContext,
  input: {
    userId: number;
    providerAccountId: string;
    rawToken: string;
    expiresAt: Date;
  },
): Promise<void> {
  await e2e.prisma.pendingAuthProviderLink.create({
    data: {
      userId: input.userId,
      provider: 'google',
      providerAccountId: input.providerAccountId,
      tokenHash: createHash('sha256').update(input.rawToken).digest('hex'),
      expiresAt: input.expiresAt,
    },
  });
}

export async function mailpitMessageCount(
  baseUrl: string,
  recipient: string,
): Promise<number> {
  const query = encodeURIComponent(`to:"${recipient}"`);
  const response = await fetch(`${baseUrl}/api/v1/search?query=${query}`);
  if (!response.ok) {
    throw new Error(`Mailpit search failed with status ${response.status}`);
  }
  const body = (await response.json()) as {
    messages_count?: number;
    count?: number;
  };
  return body.messages_count ?? body.count ?? 0;
}

export function expectTokens(data: Record<string, unknown>): void {
  expect(data.accessToken).toEqual(expect.any(String));
  expect(data.refreshToken).toEqual(expect.any(String));
}

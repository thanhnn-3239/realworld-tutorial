import { randomBytes } from 'node:crypto';
import { AUTH_VALIDATION } from '../auth.config';

/** Numbered suffixes are tried before falling back to randomness. */
export const MAX_NUMBERED_ATTEMPTS = 5;

const DISALLOWED_CHARACTERS = /[^a-z0-9._-]+/g;
const RANDOM_SUFFIX_BYTES = 2;
const SHORT_NAME_PREFIX = 'user';

/**
 * Narrower than registration enforces — `RegisterDto` bounds `username` by length only —
 * because a generated name lands in a public URL segment and should need no escaping.
 */
export function baseUsernameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart
    .split('+')[0]
    .toLowerCase()
    .replace(DISALLOWED_CHARACTERS, '')
    .slice(0, AUTH_VALIDATION.username.maxLength);

  if (cleaned.length >= AUTH_VALIDATION.username.minLength) {
    return cleaned;
  }

  return `${SHORT_NAME_PREFIX}${cleaned}`.slice(
    0,
    AUTH_VALIDATION.username.maxLength,
  );
}

/**
 * `randomSuffix` is injectable so a test can assert the shape of the fallback without
 * depending on chance.
 */
export function usernameCandidate(
  base: string,
  attempt: number,
  randomSuffix: () => string = defaultRandomSuffix,
): string {
  if (attempt <= 1) {
    return base;
  }

  const suffix =
    attempt <= MAX_NUMBERED_ATTEMPTS ? String(attempt) : randomSuffix();
  const room = AUTH_VALIDATION.username.maxLength - suffix.length;

  return `${base.slice(0, room)}${suffix}`;
}

function defaultRandomSuffix(): string {
  return randomBytes(RANDOM_SUFFIX_BYTES).toString('hex');
}

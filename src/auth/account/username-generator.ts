import { randomBytes } from 'node:crypto';
import { AUTH_VALIDATION } from '../auth.config';

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
 * Generates a unique username by combining base name from email with timestamp and random suffix.
 */
export function generateUsername(
  email: string,
  timeProvider: () => number = Date.now,
  randomSuffix: () => string = defaultRandomSuffix,
): string {
  const base = baseUsernameFromEmail(email);
  const timeStr = String(timeProvider());
  const randStr = randomSuffix();
  const suffix = `_${timeStr}_${randStr}`;
  const maxBaseLength = Math.max(
    0,
    AUTH_VALIDATION.username.maxLength - suffix.length,
  );

  const truncatedBase = base.slice(0, maxBaseLength);
  return `${truncatedBase}${suffix}`.slice(
    0,
    AUTH_VALIDATION.username.maxLength,
  );
}

function defaultRandomSuffix(): string {
  return randomBytes(RANDOM_SUFFIX_BYTES).toString('hex');
}

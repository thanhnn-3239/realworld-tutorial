import { AUTH_VALIDATION } from '../auth.config';
import {
  baseUsernameFromEmail,
  MAX_NUMBERED_ATTEMPTS,
  usernameCandidate,
} from './username-generator';

describe('baseUsernameFromEmail', () => {
  it.each([
    ['john@gmail.com', 'john'],
    ['John.Doe@Example.COM', 'john.doe'],
    ['john.doe+newsletter@gmail.com', 'john.doe'],
    ['jo_hn-doe@example.com', 'jo_hn-doe'],
    ["o'brien!#$@example.com", 'obrien'],
  ])('derives %p into %p', (email, expected) => {
    expect(baseUsernameFromEmail(email)).toBe(expected);
  });

  it('truncates a long local-part to the username limit', () => {
    const base = baseUsernameFromEmail(`${'a'.repeat(60)}@example.com`);

    expect(base).toHaveLength(AUTH_VALIDATION.username.maxLength);
  });

  it.each([['ab@example.com'], ['!!!@example.com'], ['@example.com']])(
    'pads %p up to the minimum length',
    (email) => {
      const base = baseUsernameFromEmail(email);

      expect(base.length).toBeGreaterThanOrEqual(
        AUTH_VALIDATION.username.minLength,
      );
      expect(base).toMatch(/^[a-z0-9._-]+$/);
    },
  );
});

describe('usernameCandidate', () => {
  it('returns the base unchanged on the first attempt', () => {
    expect(usernameCandidate('john', 1)).toBe('john');
  });

  it.each([
    [2, 'john2'],
    [3, 'john3'],
    [MAX_NUMBERED_ATTEMPTS, `john${MAX_NUMBERED_ATTEMPTS}`],
  ])('appends the attempt number at attempt %p', (attempt, expected) => {
    expect(usernameCandidate('john', attempt)).toBe(expected);
  });

  it('falls back to a random suffix past the numbered attempts', () => {
    expect(
      usernameCandidate('john', MAX_NUMBERED_ATTEMPTS + 1, () => 'beef'),
    ).toBe('johnbeef');
  });

  it('produces a real random suffix when none is injected', () => {
    const candidate = usernameCandidate('john', MAX_NUMBERED_ATTEMPTS + 1);

    expect(candidate).toMatch(/^john[0-9a-f]{4}$/);
  });

  it('keeps the suffix inside the length limit by trimming the base', () => {
    const base = 'a'.repeat(AUTH_VALIDATION.username.maxLength);

    const candidate = usernameCandidate(base, 2);

    expect(candidate).toHaveLength(AUTH_VALIDATION.username.maxLength);
    expect(candidate.endsWith('2')).toBe(true);
  });
});

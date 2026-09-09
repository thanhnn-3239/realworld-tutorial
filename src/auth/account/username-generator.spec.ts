import { AUTH_VALIDATION } from '../auth.config';
import { baseUsernameFromEmail, generateUsername } from './username-generator';

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

describe('generateUsername', () => {
  it('generates username combining base, timestamp, and random suffix', () => {
    const username = generateUsername(
      'john@example.com',
      () => 1700000000000,
      () => 'beef',
    );

    expect(username).toBe('john_1700000000000_beef');
  });

  it('produces a valid random suffix and timestamp when defaults are used', () => {
    const username = generateUsername('john@example.com');

    expect(username).toMatch(/^john_[0-9]+_[0-9a-f]{4}$/);
    expect(username.length).toBeLessThanOrEqual(
      AUTH_VALIDATION.username.maxLength,
    );
    expect(username.length).toBeGreaterThanOrEqual(
      AUTH_VALIDATION.username.minLength,
    );
  });

  it('truncates base to ensure total length does not exceed maxLength', () => {
    const longEmail = `${'a'.repeat(50)}@example.com`;
    const username = generateUsername(
      longEmail,
      () => 1700000000000,
      () => 'beef',
    );

    expect(username).toHaveLength(AUTH_VALIDATION.username.maxLength);
    expect(username.endsWith('_1700000000000_beef')).toBe(true);
  });
});

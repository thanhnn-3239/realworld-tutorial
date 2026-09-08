import { UnauthorizedException } from '@nestjs/common';
import type { Profile } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';
import { GoogleAuthConfig } from './google-auth.config';

const CONFIG: GoogleAuthConfig = {
  clientID: 'client-id',
  clientSecret: 'client-secret',
  callbackURL: 'http://localhost:3000/v1/auth/google/callback',
};

function profileWith(emails: unknown, id = '109384572934857293845'): Profile {
  return {
    id,
    displayName: 'Jane Doe',
    emails,
  } as unknown as Profile;
}

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    strategy = new GoogleStrategy(CONFIG);
  });

  function validate(profile: Profile) {
    return strategy.validate('access', 'refresh', profile);
  }

  it('maps the profile onto a verified identity', () => {
    const identity = validate(
      profileWith([{ value: 'Jane@Example.COM', verified: true }]),
    );

    expect(identity).toEqual({
      provider: 'google',
      providerAccountId: '109384572934857293845',
      email: 'jane@example.com',
      emailVerified: true,
      displayName: 'Jane Doe',
    });
  });

  it('carries the subject id, never the email, as the account id', () => {
    const identity = validate(
      profileWith([{ value: 'jane@example.com', verified: true }], 'sub-123'),
    );

    expect(identity.providerAccountId).toBe('sub-123');
  });

  // Both shapes appear across @types/passport-google-oauth20 versions.
  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    [undefined, false],
  ])('normalizes verified=%p to %p', (verified, expected) => {
    const identity = validate(
      profileWith([{ value: 'jane@example.com', verified }]),
    );

    expect(identity.emailVerified).toBe(expected);
  });

  it.each([undefined, [], [{ value: '' }]])(
    'refuses a profile without a usable email (%p)',
    (emails) => {
      expect(() => validate(profileWith(emails))).toThrow(
        UnauthorizedException,
      );
    },
  );

  it('takes the first address when Google lists several', () => {
    const identity = validate(
      profileWith([
        { value: 'primary@example.com', verified: true },
        { value: 'other@example.com', verified: true },
      ]),
    );

    expect(identity.email).toBe('primary@example.com');
  });
});

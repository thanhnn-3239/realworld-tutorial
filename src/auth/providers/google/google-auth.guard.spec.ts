import { UnauthorizedException } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';
import { VerifiedIdentity } from '../verified-identity.interface';

const IDENTITY: VerifiedIdentity = {
  provider: 'google',
  providerAccountId: 'sub-1',
  email: 'jane@example.com',
  emailVerified: true,
};

describe('GoogleAuthGuard', () => {
  const guard = new GoogleAuthGuard();

  it('passes the identity through when the exchange succeeded', () => {
    expect(guard.handleRequest(null, IDENTITY)).toEqual(IDENTITY);
  });

  it('answers 401 rather than 500 when the code exchange failed', () => {
    // What passport-oauth2 throws for a malformed, expired or already-spent code.
    const tokenError = Object.assign(new Error('Malformed auth code.'), {
      name: 'TokenError',
    });

    expect(() => guard.handleRequest(tokenError, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('answers 401 when no identity came back and no error was raised', () => {
    expect(() => guard.handleRequest(null, undefined)).toThrow(
      UnauthorizedException,
    );
  });

  it('says nothing about why, so a probe learns nothing from the message', () => {
    expect(() => guard.handleRequest(new Error('invalid_grant'), undefined)).toThrow(
      'Google sign-in could not be completed',
    );
  });
});

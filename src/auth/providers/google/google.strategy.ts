import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { VerifiedIdentity } from '../verified-identity.interface';
import { GOOGLE_AUTH_CONFIG } from './google-auth.config';
// Type-only: a type in a decorated signature cannot be a value import while
// `isolatedModules` and `emitDecoratorMetadata` are both on.
import type { GoogleAuthConfig } from './google-auth.config';

export const GOOGLE_PROVIDER = 'google';

const GOOGLE_SCOPE = ['email', 'profile'];

/**
 * Accepts `unknown` because `@types/passport-google-oauth20` types this claim as `boolean`
 * in some versions and `boolean | string` in others; a direct comparison would be a type
 * error under one of them.
 */
function isVerified(value: unknown): boolean {
  return value === true || value === 'true';
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  GOOGLE_PROVIDER,
) {
  constructor(@Inject(GOOGLE_AUTH_CONFIG) config: GoogleAuthConfig) {
    super({ ...config, scope: GOOGLE_SCOPE });
  }

  /**
   * Passport has already exchanged the code and fetched the profile by the time this runs,
   * so this is pure mapping. Google lists the primary address first.
   *
   * `emailVerified` is passed through faithfully rather than acted on here: deciding what an
   * unverified address may do belongs to account resolution, which owns that policy.
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): VerifiedIdentity {
    const primary = profile.emails?.[0];

    if (!primary?.value) {
      throw new UnauthorizedException('Google account has no email address');
    }

    return {
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.id,
      email: primary.value.trim().toLowerCase(),
      emailVerified: isVerified(primary.verified),
      displayName: profile.displayName,
    };
  }
}

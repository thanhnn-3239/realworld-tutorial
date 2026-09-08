import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * Short enough that a leaked bearer token is worth little, long enough that a client is not
 * refreshing on every request. Exported so `AuthModule` cannot drift to a different default.
 */
export const DEFAULT_ACCESS_TOKEN_TTL = '15m';

const REFRESH_TOKEN_BYTES = 32;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * SHA-256 rather than bcrypt: the token is 32 bytes of entropy, so there is nothing to
 * brute-force, and lookup has to hit an exact-match unique index — which a salted hash
 * cannot serve.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function resolveRefreshTtlDays(configured?: string): number {
  const parsed = Number.parseInt(configured ?? '', 10);

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_REFRESH_TOKEN_TTL_DAYS;
}

@Injectable()
export class TokenService {
  private readonly ttlDays: number;
  private readonly accessTokenTtl: JwtSignOptions['expiresIn'];

  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenRepository,
    configService: ConfigService,
  ) {
    this.ttlDays = resolveRefreshTtlDays(
      configService.get<string>('REFRESH_TOKEN_TTL_DAYS'),
    );
    // `expiresIn` is a template literal type ("15m", "7d", …) that an arbitrary env string
    // cannot be proven to match, so the cast is where that unverified input is admitted.
    // A malformed value makes `sign()` throw at the first login rather than issue an
    // eternal token.
    this.accessTokenTtl = (configService.get<string>('JWT_EXPIRES_IN') ??
      DEFAULT_ACCESS_TOKEN_TTL) as JwtSignOptions['expiresIn'];
  }

  async issuePair(userId: number): Promise<TokenPair> {
    const { pair } = await this.mint(userId);

    return pair;
  }

  async rotate(rawRefreshToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokens.findByHash(
      hashRefreshToken(rawRefreshToken),
    );

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // A row that already has a successor was rotated away by its legitimate holder, so a
    // second presentation means a copy is loose. Escalate to every session, not just this
    // one — whoever holds the copy may have rotated others already.
    if (stored.replacedById !== null) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt !== null || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { pair, rowId } = await this.mint(stored.userId);
    await this.refreshTokens.markReplaced(stored.id, rowId);

    // Keeps the table bounded without a scheduled job. Safe because `replacedById` carries
    // no foreign key, so deleting a predecessor cannot violate a constraint.
    await this.refreshTokens.deleteExpired(new Date());

    return pair;
  }

  /** Idempotent: an unknown or already-revoked token still means "logged out". */
  async revoke(rawRefreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(
      hashRefreshToken(rawRefreshToken),
    );

    if (stored && stored.revokedAt === null) {
      await this.refreshTokens.revokeById(stored.id);
    }
  }

  async revokeAllForUser(
    userId: number,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId, client);
  }

  /** Returns the row id too, because rotation has to point the old row at the new one. */
  private async mint(
    userId: number,
  ): Promise<{ pair: TokenPair; rowId: number }> {
    // Expiry is passed explicitly rather than inherited from JwtModule's signOptions, so the
    // lifetime of the token is visible where the token is made and cannot be changed by an
    // unrelated edit to module configuration.
    const accessToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: this.accessTokenTtl },
    );
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(new Date().getTime() + this.ttlDays * MS_PER_DAY);

    const row = await this.refreshTokens.create(
      userId,
      hashRefreshToken(refreshToken),
      expiresAt,
    );

    return { pair: { accessToken, refreshToken }, rowId: row.id };
  }
}

import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.ttlDays = resolveRefreshTtlDays(
      configService.get<string>('REFRESH_TOKEN_TTL_DAYS'),
    );
    this.accessTokenTtl = (configService.get<string>('JWT_EXPIRES_IN') ??
      DEFAULT_ACCESS_TOKEN_TTL) as JwtSignOptions['expiresIn'];
  }

  async issueTokens(userId: number): Promise<TokenPair> {
    const { pair } = await this.createTokenPair(userId);

    return pair;
  }

  async rotate(rawRefreshToken: string): Promise<TokenPair> {
    const stored = await this.refreshTokens.findByHash(
      hashRefreshToken(rawRefreshToken),
    );

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.replacedById !== null) {
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt !== null || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let userIdToRevoke: number | null = null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { pair, rowId } = await this.createTokenPair(stored.userId, tx);

        const marked = await this.refreshTokens.markAsUsed(
          stored.id,
          rowId,
          tx,
        );
        if (!marked) {
          userIdToRevoke = stored.userId;
          throw new UnauthorizedException('Invalid refresh token');
        }

        return pair;
      });
    } catch (error) {
      if (userIdToRevoke !== null) {
        await this.refreshTokens.revokeAllForUser(userIdToRevoke);
      }
      throw error;
    }
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    const stored = await this.refreshTokens.findByHash(
      hashRefreshToken(rawRefreshToken),
    );

    if (stored && stored.revokedAt === null) {
      await this.refreshTokens.revokeById(stored.id);
    }
  }

  private async createTokenPair(
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<{ pair: TokenPair; rowId: number }> {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: this.accessTokenTtl },
    );
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      new Date().getTime() + this.ttlDays * MS_PER_DAY,
    );

    const row = await this.refreshTokens.create(
      userId,
      hashRefreshToken(refreshToken),
      expiresAt,
      tx,
    );

    return { pair: { accessToken, refreshToken }, rowId: row.id };
  }
}

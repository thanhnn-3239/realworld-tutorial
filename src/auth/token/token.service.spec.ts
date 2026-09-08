import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DEFAULT_ACCESS_TOKEN_TTL,
  DEFAULT_REFRESH_TOKEN_TTL_DAYS,
  hashRefreshToken,
  resolveRefreshTtlDays,
  TokenService,
} from './token.service';
import {
  RefreshTokenRepository,
  RefreshTokenRow,
} from './refresh-token.repository';

const USER_ID = 7;

function liveRow(overrides: Partial<RefreshTokenRow> = {}): RefreshTokenRow {
  return {
    id: 1,
    userId: USER_ID,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    replacedById: null,
    ...overrides,
  };
}

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: { sign: jest.Mock };
  let repository: {
    create: jest.Mock;
    findByHash: jest.Mock;
    markReplaced: jest.Mock;
    revokeById: jest.Mock;
    revokeAllForUser: jest.Mock;
    deleteExpired: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest
        .fn()
        .mockImplementation(() => Promise.resolve(liveRow({ id: 99 }))),
      findByHash: jest.fn().mockResolvedValue(null),
      markReplaced: jest.fn().mockResolvedValue(undefined),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      deleteExpired: jest.fn().mockResolvedValue(undefined),
    };

    jwtService = { sign: jest.fn(() => 'signed.access.token') };
    // One stub answers both keys; only REFRESH_TOKEN_TTL_DAYS is numeric.
    const configService = {
      get: jest.fn((key: string) =>
        key === 'REFRESH_TOKEN_TTL_DAYS' ? '30' : '15m',
      ),
    } as unknown as ConfigService;

    service = new TokenService(
      jwtService as unknown as JwtService,
      repository as unknown as RefreshTokenRepository,
      configService,
    );
  });

  describe('issuePair', () => {
    it('stores only the hash of the refresh token it returns', async () => {
      const pair = await service.issuePair(USER_ID);

      expect(pair.accessToken).toBe('signed.access.token');
      expect(pair.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const [userId, storedHash] = repository.create.mock.calls[0];
      expect(userId).toBe(USER_ID);
      expect(storedHash).toBe(hashRefreshToken(pair.refreshToken));
      expect(storedHash).not.toContain(pair.refreshToken);
    });

    it('signs the access token with a sub-only payload and an explicit expiry', async () => {
      await service.issuePair(USER_ID);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: USER_ID },
        { expiresIn: '15m' },
      );
    });

    it('falls back to the default access-token lifetime when none is configured', async () => {
      const bareConfig = {
        get: jest.fn(() => undefined),
      } as unknown as ConfigService;
      const bare = new TokenService(
        jwtService as unknown as JwtService,
        repository as unknown as RefreshTokenRepository,
        bareConfig,
      );

      await bare.issuePair(USER_ID);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: USER_ID },
        { expiresIn: DEFAULT_ACCESS_TOKEN_TTL },
      );
    });
  });

  describe('rotate', () => {
    it('issues a new pair and records the successor on the old row', async () => {
      repository.findByHash.mockResolvedValue(liveRow({ id: 41 }));

      const pair = await service.rotate('whatever');

      expect(pair.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(repository.markReplaced).toHaveBeenCalledWith(41, 99);
      expect(repository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('revokes every session when a replaced token is presented again', async () => {
      repository.findByHash.mockResolvedValue(
        liveRow({ id: 41, replacedById: 99 }),
      );

      await expect(service.rotate('replayed')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.revokeAllForUser).toHaveBeenCalledWith(USER_ID);
    });

    it('rejects a revoked token without revoking the rest', async () => {
      repository.findByHash.mockResolvedValue(
        liveRow({ revokedAt: new Date() }),
      );

      await expect(service.rotate('revoked')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      repository.findByHash.mockResolvedValue(
        liveRow({ expiresAt: new Date(Date.now() - 1) }),
      );

      await expect(service.rotate('expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an unknown token', async () => {
      await expect(service.rotate('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('deletes expired rows opportunistically on a successful rotation', async () => {
      repository.findByHash.mockResolvedValue(liveRow());

      await service.rotate('valid');

      expect(repository.deleteExpired).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('revokes the row behind the presented token', async () => {
      repository.findByHash.mockResolvedValue(liveRow({ id: 12 }));

      await service.revoke('bye');

      expect(repository.revokeById).toHaveBeenCalledWith(12);
    });

    it('treats an unknown token as already logged out', async () => {
      await expect(service.revoke('nonexistent')).resolves.toBeUndefined();
      expect(repository.revokeById).not.toHaveBeenCalled();
    });
  });

  describe('resolveRefreshTtlDays', () => {
    it.each([undefined, '', 'abc', '0', '-5'])(
      'falls back to the default for %p',
      (configured) => {
        expect(resolveRefreshTtlDays(configured)).toBe(
          DEFAULT_REFRESH_TOKEN_TTL_DAYS,
        );
      },
    );

    it('accepts a positive integer', () => {
      expect(resolveRefreshTtlDays('7')).toBe(7);
    });
  });
});

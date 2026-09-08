import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token/token.service';
import { PasswordService } from '../common/password/password.service';

const PAIR = { accessToken: 'access.jwt', refreshToken: 'refresh-opaque' };

const storedUser = {
  id: 7,
  email: 'jake@jake.jake',
  username: 'jake',
  password: 'hashed',
  bio: 'I work at statefarm',
  image: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let repository: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    findByUsername: jest.Mock;
    findByEmailWithPassword: jest.Mock;
  };
  let tokenService: { issuePair: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };
  let passwordService: { hash: jest.Mock; compare: jest.Mock };

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({ ...storedUser, bio: null }),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByUsername: jest.fn().mockResolvedValue(null),
      findByEmailWithPassword: jest.fn().mockResolvedValue(storedUser),
    };
    tokenService = {
      issuePair: jest.fn().mockResolvedValue(PAIR),
      rotate: jest.fn().mockResolvedValue(PAIR),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    passwordService = {
      // Echoes its input: a real hash depends on what was hashed, and this is what lets a
      // test tell the dummy hash apart from a stored one.
      hash: jest.fn((plain: string) => Promise.resolve(`hashed:${plain}`)),
      compare: jest.fn().mockResolvedValue(true),
    };

    service = new AuthService(
      repository as unknown as AuthRepository,
      tokenService as unknown as TokenService,
      passwordService as unknown as PasswordService,
    );
  });

  const registerDto = {
    email: 'jake@jake.jake',
    username: 'jake',
    password: 'password123',
    password_confirmation: 'password123',
  };

  describe('register', () => {
    it('returns the pair issued for the new user id', async () => {
      const result = await service.register(registerDto);

      expect(tokenService.issuePair).toHaveBeenCalledWith(7);
      expect(result.accessToken).toBe(PAIR.accessToken);
      expect(result.refreshToken).toBe(PAIR.refreshToken);
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('password');
    });

    it('rejects a taken email before touching the token service', async () => {
      repository.findByEmail.mockResolvedValue(storedUser);

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tokenService.issuePair).not.toHaveBeenCalled();
    });

    it('rejects a taken username before touching the token service', async () => {
      repository.findByUsername.mockResolvedValue(storedUser);

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tokenService.issuePair).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns the pair plus the stored profile fields', async () => {
      const result = await service.login({
        email: 'jake@jake.jake',
        password: 'password123',
      });

      expect(tokenService.issuePair).toHaveBeenCalledWith(7);
      expect(result.bio).toBe('I work at statefarm');
      expect(result.accessToken).toBe(PAIR.accessToken);
    });

    it('rejects a wrong password without issuing anything', async () => {
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'jake@jake.jake', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.issuePair).not.toHaveBeenCalled();
    });

    it('rejects an unknown email', async () => {
      repository.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a provider-only account that has no password', async () => {
      repository.findByEmailWithPassword.mockResolvedValue({
        ...storedUser,
        password: null,
      });

      await expect(
        service.login({ email: storedUser.email, password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenService.issuePair).not.toHaveBeenCalled();
    });

    it('still compares once when no user matches, so timing does not disclose the address', async () => {
      repository.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow('Invalid credentials');

      expect(passwordService.compare).toHaveBeenCalledTimes(1);

      // The comparison ran against the dummy hash, not against any stored value, and the
      // dummy secret is random rather than derived from the submitted password.
      const [, hashUsed] = passwordService.compare.mock.calls[0];
      expect(hashUsed).not.toBe(storedUser.password);
      expect(hashUsed).toMatch(/^hashed:[0-9a-f]{64}$/);
    });

    it('still compares once for a provider-only account', async () => {
      repository.findByEmailWithPassword.mockResolvedValue({
        ...storedUser,
        password: null,
      });

      await expect(
        service.login({ email: storedUser.email, password: 'password123' }),
      ).rejects.toThrow('Invalid credentials');

      expect(passwordService.compare).toHaveBeenCalledTimes(1);
    });

    it('compares exactly once on the successful path too', async () => {
      await service.login({ email: storedUser.email, password: 'password123' });

      expect(passwordService.compare).toHaveBeenCalledTimes(1);
    });

    it('never lets a provider-only account in even if the comparison somehow passes', async () => {
      repository.findByEmailWithPassword.mockResolvedValue({
        ...storedUser,
        password: null,
      });
      passwordService.compare.mockResolvedValue(true);

      await expect(
        service.login({ email: storedUser.email, password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('warms the dummy hash at startup, through the same service so the cost matches', async () => {
      expect(passwordService.hash).not.toHaveBeenCalled();

      await service.onModuleInit();

      expect(passwordService.hash).toHaveBeenCalledTimes(1);
      const [secret] = passwordService.hash.mock.calls[0];
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
    });

    it('reuses the same dummy hash instead of paying for it again', async () => {
      repository.findByEmailWithPassword.mockResolvedValue(null);

      await expect(service.login({ email: 'a@b.io', password: 'x' })).rejects.toThrow();
      await expect(service.login({ email: 'c@d.io', password: 'x' })).rejects.toThrow();

      expect(passwordService.hash).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh and logout', () => {
    it('delegates rotation to the token service', async () => {
      await expect(service.refresh({ refreshToken: 'raw' })).resolves.toEqual(
        PAIR,
      );
      expect(tokenService.rotate).toHaveBeenCalledWith('raw');
    });

    it('delegates revocation to the token service', async () => {
      await service.logout({ refreshToken: 'raw' });

      expect(tokenService.revoke).toHaveBeenCalledWith('raw');
    });
  });
});

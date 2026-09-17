import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  createAuthServiceTestContext,
  STORED_USER,
  TOKEN_PAIR,
} from './testing/auth-service-test-context';

const REGISTER_DTO = {
  email: STORED_USER.email,
  username: STORED_USER.username,
  password: 'password123',
  password_confirmation: 'password123',
};

describe('AuthService password and session flows', () => {
  it('registers a new user and returns its token pair', async () => {
    const { service, tokenService } = createAuthServiceTestContext();

    const result = await service.register(REGISTER_DTO);

    expect(tokenService.issueTokens).toHaveBeenCalledWith(STORED_USER.id);
    expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    expect(result.refreshToken).toBe(TOKEN_PAIR.refreshToken);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('password');
  });

  it('rejects a taken email before issuing tokens', async () => {
    const { service, repository, tokenService } =
      createAuthServiceTestContext();
    repository.findByEmail.mockResolvedValue(STORED_USER);

    await expect(service.register(REGISTER_DTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects a taken username before issuing tokens', async () => {
    const { service, repository, tokenService } =
      createAuthServiceTestContext();
    repository.findByUsername.mockResolvedValue(STORED_USER);

    await expect(service.register(REGISTER_DTO)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('logs in with the stored profile and token pair', async () => {
    const { service, tokenService, passwordService } =
      createAuthServiceTestContext();

    const result = await service.login({
      email: STORED_USER.email,
      password: 'password123',
    });

    expect(tokenService.issueTokens).toHaveBeenCalledWith(STORED_USER.id);
    expect(passwordService.compare).toHaveBeenCalledTimes(1);
    expect(result.bio).toBe(STORED_USER.bio);
    expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
  });

  it('rejects a wrong password without issuing tokens', async () => {
    const { service, passwordService, tokenService } =
      createAuthServiceTestContext();
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({ email: STORED_USER.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('returns the stored avatar as a public URL', async () => {
    const { service, repository } = createAuthServiceTestContext();
    repository.findByEmailWithPassword.mockResolvedValue({
      ...STORED_USER,
      image: 'public/uploads/User/7/a.png',
    });

    const result = await service.login({
      email: STORED_USER.email,
      password: 'password123',
    });

    expect(result.image).toBe('https://cdn.test/public/uploads/User/7/a.png');
  });

  it.each([
    ['an unknown email', null],
    ['a provider-only account', { ...STORED_USER, password: null }],
  ])('rejects %s after exactly one password comparison', async (_, user) => {
    const { service, repository, passwordService, tokenService } =
      createAuthServiceTestContext();
    repository.findByEmailWithPassword.mockResolvedValue(user);

    await expect(
      service.login({ email: STORED_USER.email, password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(passwordService.compare).toHaveBeenCalledTimes(1);
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('uses a random same-cost dummy hash for an unknown email', async () => {
    const { service, repository, passwordService } =
      createAuthServiceTestContext();
    repository.findByEmailWithPassword.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toThrow('Invalid credentials');

    const [, hashUsed] = passwordService.compare.mock.calls[0];
    expect(hashUsed).not.toBe(STORED_USER.password);
    expect(hashUsed).toMatch(/^hashed:[0-9a-f]{64}$/);
  });

  it('warms and reuses the dummy hash', async () => {
    const { service, repository, passwordService } =
      createAuthServiceTestContext();

    await service.onModuleInit();
    repository.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@b.io', password: 'x' }),
    ).rejects.toThrow();
    await expect(
      service.login({ email: 'c@d.io', password: 'x' }),
    ).rejects.toThrow();

    expect(passwordService.hash).toHaveBeenCalledTimes(1);
    expect(passwordService.hash.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rotates and revokes refresh tokens through TokenService', async () => {
    const { service, tokenService } = createAuthServiceTestContext();

    await expect(service.refresh({ refreshToken: 'raw' })).resolves.toEqual(
      TOKEN_PAIR,
    );
    await service.logout({ refreshToken: 'raw' });

    expect(tokenService.rotate).toHaveBeenCalledWith('raw');
    expect(tokenService.revoke).toHaveBeenCalledWith('raw');
  });
});

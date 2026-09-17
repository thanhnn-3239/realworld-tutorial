import { createAuthServiceTestContext } from './testing/auth-service-test-context';

const IDENTITY = {
  provider: 'google',
  providerAccountId: '12345',
  email: 'jake@jake.jake',
  emailVerified: true,
};

describe('AuthService OAuth callback', () => {
  it('issues tokens only for an account resolution', async () => {
    const { service, accountResolver, tokenService } =
      createAuthServiceTestContext();

    const result = await service.handleOAuthCallback(IDENTITY);

    expect(accountResolver.resolve).toHaveBeenCalledWith(IDENTITY);
    expect(tokenService.issueTokens).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      kind: 'authenticated',
      data: expect.objectContaining({
        email: 'jake@jake.jake',
        username: 'jake',
        accessToken: 'access.jwt',
        refreshToken: 'refresh-opaque',
      }),
    });
  });

  it('returns a public avatar URL for an authenticated result', async () => {
    const { service, accountResolver } = createAuthServiceTestContext();
    accountResolver.resolve.mockResolvedValue({
      kind: 'account',
      account: {
        id: 7,
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'I work at statefarm',
        image: 'public/uploads/User/7/a.png',
      },
    });

    const result = await service.handleOAuthCallback(IDENTITY);

    expect(result).toEqual({
      kind: 'authenticated',
      data: expect.objectContaining({
        image: 'https://cdn.test/public/uploads/User/7/a.png',
      }),
    });
  });

  it('returns confirmation-required without issuing tokens', async () => {
    const { service, accountResolver, tokenService } =
      createAuthServiceTestContext();
    accountResolver.resolve.mockResolvedValue({
      kind: 'confirmation-required',
    });

    await expect(service.handleOAuthCallback(IDENTITY)).resolves.toEqual({
      kind: 'confirmation-required',
      data: { status: 'confirmation_required' },
    });
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });

  it('confirms a Google link without issuing tokens', async () => {
    const { service, providerLinks, tokenService } =
      createAuthServiceTestContext();
    const dto = { token: 'a'.repeat(43) };

    await expect(service.confirmGoogleLink(dto)).resolves.toEqual({
      confirmed: true,
    });
    expect(providerLinks.confirm).toHaveBeenCalledWith(dto.token);
    expect(tokenService.issueTokens).not.toHaveBeenCalled();
  });
});

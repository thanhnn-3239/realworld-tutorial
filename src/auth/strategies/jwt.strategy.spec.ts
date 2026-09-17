import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

// A token minted before this change carries `id`/`email`/`username`. The type documents that
// such tokens still reach `validate`, and that nothing but `sub` survives it.
type JwtPayloadWithExtras = { sub: number; email: string };

function configWith(secret: string | undefined): ConfigService {
  return { get: jest.fn(() => secret) } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  it('refuses to construct without a signing secret', () => {
    expect(() => new JwtStrategy(configWith(undefined))).toThrow(
      'JWT_SECRET is not defined in environment variables',
    );
  });

  it('maps the sub claim onto the request user as id', () => {
    const strategy = new JwtStrategy(configWith('test-secret'));

    expect(strategy.validate({ sub: 42 })).toEqual({ id: 42 });
  });

  it('ignores any extra claim a token happens to carry', () => {
    const strategy = new JwtStrategy(configWith('test-secret'));

    const result = strategy.validate({
      sub: 42,
      email: 'stale@example.com',
    } as JwtPayloadWithExtras);

    expect(result).toEqual({ id: 42 });
  });
});

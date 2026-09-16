import { parseRedisUrl } from './redis.config';

describe('parseRedisUrl', () => {
  it('parses valid redis URL with authentication and database', () => {
    expect(parseRedisUrl('redis://user:secret@redis:6379/2')).toEqual({
      host: 'redis',
      port: 6379,
      username: 'user',
      password: 'secret',
      db: 2,
    });
  });

  it('parses rediss URL and enables TLS with default port', () => {
    expect(parseRedisUrl('rediss://cache.example.com')).toEqual(
      expect.objectContaining({ host: 'cache.example.com', tls: {} }),
    );
  });

  it('parses minimal redis URL with default port', () => {
    expect(parseRedisUrl('redis://127.0.0.1')).toEqual({
      host: '127.0.0.1',
      port: 6379,
    });
  });

  it('parses password-only authentication', () => {
    expect(parseRedisUrl('redis://:mysecret@localhost:6380')).toEqual({
      host: 'localhost',
      port: 6380,
      password: 'mysecret',
    });
  });

  it('parses database index 0', () => {
    expect(parseRedisUrl('redis://localhost:6379/0')).toEqual({
      host: 'localhost',
      port: 6379,
      db: 0,
    });
  });

  it.each([
    'http://redis:6379',
    'https://redis:6379',
    'ftp://redis:6379',
    'ws://redis:6379',
  ])('rejects unsupported scheme %s', (url) => {
    expect(() => parseRedisUrl(url)).toThrow(
      'REDIS_URL must use redis: or rediss:',
    );
  });

  it.each(['', '   ', 'not-a-url'])(
    'rejects invalid or empty URL %s',
    (url) => {
      expect(() => parseRedisUrl(url)).toThrow();
    },
  );

  it.each(['redis://', 'redis://:6379', 'rediss://'])(
    'rejects missing host in %s',
    (url) => {
      expect(() => parseRedisUrl(url)).toThrow(/host/i);
    },
  );

  it.each([
    'redis://redis:0',
    'redis://redis:70000',
    'redis://redis:abc',
    'redis://redis:',
  ])('rejects invalid port in %s', (url) => {
    expect(() => parseRedisUrl(url)).toThrow(/port/i);
  });

  it.each([
    'redis://redis:6379/abc',
    'redis://redis:6379/1/2',
    'redis://redis:6379/-1',
  ])('rejects non-numeric database in %s', (url) => {
    expect(() => parseRedisUrl(url)).toThrow(/numeric/i);
  });
});

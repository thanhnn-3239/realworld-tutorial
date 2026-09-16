import type { RedisOptions } from 'bullmq';

const DEFAULT_REDIS_PORT = 6379;

export function parseRedisUrl(value: string): RedisOptions {
  const url = new URL(value);

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis: or rediss:');
  }

  const db = url.pathname.replace(/^\//u, '');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_REDIS_PORT,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(db && !Number.isNaN(Number(db)) ? { db: Number(db) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

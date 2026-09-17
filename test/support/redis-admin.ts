import Redis from 'ioredis';

const E2E_PREFIX_PATTERN = /^realworld:e2e:[a-zA-Z0-9_-]+:$/u;
const SCAN_COUNT = 100;

export function assertSafeRedisPrefix(prefix: string): void {
  if (!prefix || !E2E_PREFIX_PATTERN.test(prefix)) {
    throw new Error('Refusing to delete Redis keys outside an E2E run prefix');
  }
}

export async function sweepRunRedis(
  redisUrl: string,
  runId: string,
): Promise<number> {
  const prefix = `realworld:e2e:${runId}:`;
  assertSafeRedisPrefix(prefix);

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  let cursor = '0';
  let deleted = 0;

  try {
    await redis.connect();
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        SCAN_COUNT,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }

  return deleted;
}

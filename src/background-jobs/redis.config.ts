import type { RedisOptions } from 'bullmq';

const DEFAULT_REDIS_PORT = 6379;

export function parseRedisUrl(value: string): RedisOptions {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('REDIS_URL must be a non-empty string');
  }

  const trimmed = value.trim();
  const protocolMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//u);
  if (!protocolMatch) {
    throw new Error('REDIS_URL must be a valid URL');
  }

  const protocol = protocolMatch[1].toLowerCase();
  if (protocol !== 'redis' && protocol !== 'rediss') {
    throw new Error('REDIS_URL must use redis: or rediss:');
  }

  const afterProtocol = trimmed.slice(protocolMatch[0].length);
  const slashIndex = afterProtocol.indexOf('/');
  const questionIndex = afterProtocol.indexOf('?');
  const hashIndex = afterProtocol.indexOf('#');
  const delimiterIndices = [slashIndex, questionIndex, hashIndex].filter(
    (idx) => idx !== -1,
  );
  const endOfAuthority =
    delimiterIndices.length > 0
      ? Math.min(...delimiterIndices)
      : afterProtocol.length;

  const authority = afterProtocol.slice(0, endOfAuthority);
  const rest = afterProtocol.slice(endOfAuthority);

  let userInfo = '';
  let hostPort = authority;
  const atIndex = authority.indexOf('@');
  if (atIndex !== -1) {
    userInfo = authority.slice(0, atIndex);
    hostPort = authority.slice(atIndex + 1);
  }

  if (!hostPort || hostPort.startsWith(':')) {
    throw new Error('REDIS_URL must include a valid host');
  }

  let host = hostPort;
  let port = DEFAULT_REDIS_PORT;

  if (hostPort.includes(':')) {
    const colonIndex = hostPort.indexOf(':');
    host = hostPort.slice(0, colonIndex);
    const portString = hostPort.slice(colonIndex + 1);

    if (!host) {
      throw new Error('REDIS_URL must include a valid host');
    }

    if (!/^\d+$/u.test(portString)) {
      throw new Error('REDIS_URL port must be a valid port number (1-65535)');
    }

    const parsedPort = Number(portString);
    if (parsedPort < 1 || parsedPort > 65535) {
      throw new Error('REDIS_URL port must be a valid port number (1-65535)');
    }
    port = parsedPort;
  }

  let db: number | undefined;
  if (rest.startsWith('/')) {
    const pathname = rest.split(/[?#]/u)[0].slice(1);
    if (pathname.length > 0) {
      if (!/^\d+$/u.test(pathname)) {
        throw new Error('REDIS_URL database must be a numeric index');
      }
      db = parseInt(pathname, 10);
    }
  }

  const options: RedisOptions = {
    host,
    port,
  };

  if (userInfo) {
    const userColonIndex = userInfo.indexOf(':');
    if (userColonIndex !== -1) {
      const user = userInfo.slice(0, userColonIndex);
      const pass = userInfo.slice(userColonIndex + 1);
      if (user) {
        options.username = decodeURIComponent(user);
      }
      if (pass) {
        options.password = decodeURIComponent(pass);
      }
    } else {
      options.username = decodeURIComponent(userInfo);
    }
  }

  if (db !== undefined) {
    options.db = db;
  }

  if (protocol === 'rediss') {
    options.tls = {};
  }

  return options;
}

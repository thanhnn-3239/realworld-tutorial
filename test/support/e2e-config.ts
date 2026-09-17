import { normalizeSuiteLabel } from './e2e-resource-names';

export interface E2eBaseConfig {
  readonly databaseUrl: string;
  readonly storageEndpoint: string;
  readonly storageAccessKey: string;
  readonly storageSecretKey: string;
  readonly storageRegion: string;
  readonly redisUrl: string;
  readonly redisPrefix: string;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly mailFrom: string;
  readonly mailpitApiUrl: string;
  readonly googleLinkConfirmUrl: string;
}

export interface E2eSuiteConfig extends E2eBaseConfig {
  readonly databaseName: string;
  readonly bucketName: string;
  readonly storagePublicUrl: string;
}

function requireValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for E2E tests`);
  }

  return value;
}

function requireUrl(env: NodeJS.ProcessEnv, key: string): string {
  const value = requireValue(env, key);

  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
}

export function readE2eBaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): Readonly<E2eBaseConfig> {
  if (env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV must equal test');
  }

  const smtpPortRaw = env.SMTP_PORT?.trim() || '1025';
  const smtpPort = parseInt(smtpPortRaw, 10);
  if (Number.isNaN(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  return Object.freeze({
    databaseUrl: requireUrl(env, 'DATABASE_URL'),
    storageEndpoint: requireUrl(env, 'STORAGE_ENDPOINT').replace(/\/$/u, ''),
    storageAccessKey: requireValue(env, 'STORAGE_ACCESS_KEY'),
    storageSecretKey: requireValue(env, 'STORAGE_SECRET_KEY'),
    storageRegion: env.STORAGE_REGION?.trim() || 'us-east-1',
    redisUrl: requireUrl(env, 'REDIS_URL'),
    redisPrefix: env.REDIS_PREFIX?.trim() || 'realworld-e2e',
    smtpHost: requireValue(env, 'SMTP_HOST'),
    smtpPort,
    mailFrom: requireValue(env, 'MAIL_FROM'),
    mailpitApiUrl: requireUrl(env, 'MAILPIT_API_URL').replace(/\/$/u, ''),
    googleLinkConfirmUrl: requireUrl(env, 'GOOGLE_LINK_CONFIRM_URL'),
  });
}

export function buildE2eSuiteConfig(
  base: E2eBaseConfig,
  databaseName: string,
  bucketName: string,
  runId: string,
  label: string,
): Readonly<E2eSuiteConfig> {
  const databaseUrl = new URL(base.databaseUrl);
  databaseUrl.pathname = `/${databaseName}`;
  databaseUrl.search = '';

  const safeLabel = normalizeSuiteLabel(label);

  return Object.freeze({
    ...base,
    databaseName,
    bucketName,
    databaseUrl: databaseUrl.toString(),
    storagePublicUrl: `${base.storageEndpoint}/${bucketName}`,
    redisPrefix: 'realworld:e2e:' + runId + ':' + safeLabel,
  });
}

export interface E2eBaseConfig {
  readonly databaseUrl: string;
  readonly storageEndpoint: string;
  readonly storageAccessKey: string;
  readonly storageSecretKey: string;
  readonly storageRegion: string;
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

  return Object.freeze({
    databaseUrl: requireUrl(env, 'DATABASE_URL'),
    storageEndpoint: requireUrl(env, 'STORAGE_ENDPOINT').replace(/\/$/u, ''),
    storageAccessKey: requireValue(env, 'STORAGE_ACCESS_KEY'),
    storageSecretKey: requireValue(env, 'STORAGE_SECRET_KEY'),
    storageRegion: env.STORAGE_REGION?.trim() || 'us-east-1',
  });
}

export function buildE2eSuiteConfig(
  base: E2eBaseConfig,
  databaseName: string,
  bucketName: string,
): Readonly<E2eSuiteConfig> {
  const databaseUrl = new URL(base.databaseUrl);
  databaseUrl.pathname = `/${databaseName}`;
  databaseUrl.search = '';

  return Object.freeze({
    ...base,
    databaseName,
    bucketName,
    databaseUrl: databaseUrl.toString(),
    storagePublicUrl: `${base.storageEndpoint}/${bucketName}`,
  });
}

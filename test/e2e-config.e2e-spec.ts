import { buildE2eSuiteConfig, readE2eBaseConfig } from './support/e2e-config';
import {
  assertSafeBucketName,
  assertSafeDatabaseName,
  normalizeSuiteLabel,
  suiteBucketName,
  suiteDatabaseName,
  templateDatabaseName,
} from './support/e2e-resource-names';

const RUN_ID = 'a1b2c3d4e5f6';

function validEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://e2e:e2e@postgres:5432/realworld_e2e',
    STORAGE_ENDPOINT: 'http://minio:9000',
    STORAGE_ACCESS_KEY: 'access',
    STORAGE_SECRET_KEY: 'secret',
    ...overrides,
  };
}

describe('E2E configuration', () => {
  it.each([undefined, 'development', 'production'])(
    'rejects NODE_ENV=%s',
    (nodeEnv) => {
      expect(() => readE2eBaseConfig(validEnv({ NODE_ENV: nodeEnv }))).toThrow(
        'NODE_ENV must equal test',
      );
    },
  );

  it('returns frozen validated defaults without changing its input', () => {
    const env = validEnv();
    const config = readE2eBaseConfig(env);

    expect(config).toEqual({
      databaseUrl: env.DATABASE_URL,
      storageEndpoint: env.STORAGE_ENDPOINT,
      storageAccessKey: 'access',
      storageSecretKey: 'secret',
      storageRegion: 'us-east-1',
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(env.STORAGE_REGION).toBeUndefined();
  });

  it.each(['DATABASE_URL', 'STORAGE_ENDPOINT'] as const)(
    'rejects a missing or malformed %s',
    (key) => {
      expect(() => readE2eBaseConfig(validEnv({ [key]: 'not a url' }))).toThrow(
        key,
      );
    },
  );

  it('builds a frozen suite config with derived URLs', () => {
    const base = readE2eBaseConfig(validEnv());
    const config = buildE2eSuiteConfig(
      base,
      `e2e_${RUN_ID}_articles`,
      `e2e-${RUN_ID}-articles`,
    );

    expect(config.databaseUrl).toBe(
      `postgresql://e2e:e2e@postgres:5432/e2e_${RUN_ID}_articles`,
    );
    expect(config.storagePublicUrl).toBe(
      `http://minio:9000/e2e-${RUN_ID}-articles`,
    );
    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe('E2E resource names', () => {
  it('builds distinct guarded names for two suite labels', () => {
    expect(suiteDatabaseName(RUN_ID, 'articles')).not.toBe(
      suiteDatabaseName(RUN_ID, 'comments'),
    );
    expect(suiteBucketName(RUN_ID, 'articles')).not.toBe(
      suiteBucketName(RUN_ID, 'comments'),
    );
  });

  it('normalizes labels and constructs the template name', () => {
    expect(normalizeSuiteLabel('Article HTTP / CRUD')).toBe(
      'article_http_crud',
    );
    expect(templateDatabaseName(RUN_ID)).toBe(`e2e_${RUN_ID}_tpl`);
  });

  it.each(['realworld', 'postgres', 'e2e_wrong'])(
    'rejects unsafe database %s',
    (name) => {
      expect(() => assertSafeDatabaseName(name, RUN_ID)).toThrow();
    },
  );

  it.each(['realworld', 'e2e-other-run-users'])(
    'rejects unsafe bucket %s',
    (name) => {
      expect(() => assertSafeBucketName(name, RUN_ID)).toThrow();
    },
  );

  it('rejects empty labels and names from a different run', () => {
    expect(() => suiteDatabaseName(RUN_ID, '---')).toThrow();
    expect(() =>
      assertSafeDatabaseName(`e2e_000000000000_articles`, RUN_ID),
    ).toThrow();
  });
});

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/common/bootstrap/configure-app';
import type { E2eSuiteConfig } from './e2e-config';
import { TestDatabase } from './test-database';

/**
 * PrismaService reads configuration only through `get()`, so answering one key
 * and delegating the rest is enough to redirect it. Delegating matters:
 * `NODE_ENV` and `DEBUG_SQL` still decide whether query logging turns on.
 */
function configForSuite(config: E2eSuiteConfig): ConfigService {
  const values: Readonly<Record<string, string>> = {
    DATABASE_URL: config.databaseUrl,
    STORAGE_ENDPOINT: config.storageEndpoint,
    STORAGE_BUCKET: config.bucketName,
    STORAGE_ACCESS_KEY: config.storageAccessKey,
    STORAGE_SECRET_KEY: config.storageSecretKey,
    STORAGE_PUBLIC_URL: config.storagePublicUrl,
    STORAGE_REGION: config.storageRegion,
  };
  const facade = {
    get: <T>(key: string, defaultValue?: T) =>
      (values[key] ?? process.env[key] ?? defaultValue) as T,
  };

  return facade as unknown as ConfigService;
}

/**
 * Redirects the app by overriding the provider rather than mutating
 * `process.env`, so nothing leaks into whichever suite Jest runs next in this
 * worker and no spec has to remember to restore anything.
 *
 * Overriding keeps PrismaService a singleton — `CustomLoggerService` is
 * TRANSIENT and only REQUEST scope propagates upwards — which is what lets
 * specs keep reaching for it via `app.get(PrismaService)`.
 */
export async function createTestApp(
  db: TestDatabase,
  suiteConfig: E2eSuiteConfig,
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue(configForSuite({ ...suiteConfig, databaseUrl: db.url }))
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return app;
}

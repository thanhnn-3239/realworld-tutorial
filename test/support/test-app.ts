import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/common/bootstrap/configure-app';
import { CustomLoggerService } from '../../src/logger/logger.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestDatabase } from './test-database';

/**
 * PrismaService reads configuration only through `get()`, so answering one key
 * and delegating the rest is enough to redirect it. Delegating matters:
 * `NODE_ENV` and `DEBUG_SQL` still decide whether query logging turns on.
 */
function configPointingAt(config: ConfigService, url: string): ConfigService {
  const stub = {
    get: (key: string) => (key === 'DATABASE_URL' ? url : config.get(key)),
  };

  return stub as unknown as ConfigService;
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
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useFactory({
      inject: [ConfigService, CustomLoggerService],
      factory: (config: ConfigService, logger: CustomLoggerService) =>
        new PrismaService(configPointingAt(config, db.url), logger),
    })
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return app;
}

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

// Matched as a shape because the greeting embeds a live row count: a literal
// would pin the assertion to whatever data the target database happens to hold.
const GREETING = /^Hello! Welcome to RealWorld API - Users: \d+$/;
const HOOK_TIMEOUT_MS = 60_000;

describe('AppController (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;

  beforeAll(async () => {
    db = await createTestDatabase('app_smoke');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('App smoke e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  it('/v1 (GET)', async () => {
    const response = await request(httpServer()).get('/v1').expect(200);

    expect(response.body).toMatchObject({
      statusCode: 200,
      message: 'Success',
      data: expect.stringMatching(GREETING),
    });
  });
});

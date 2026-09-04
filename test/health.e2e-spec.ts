import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Health (e2e)', () => {
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;

  beforeAll(async () => {
    db = await createTestDatabase('health');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Health e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  it('serves /health without the v1 prefix', async () => {
    const response = await request(httpServer())
      .get('/health')
      .expect(HttpStatus.OK);

    expect(response.body).toEqual({
      statusCode: HttpStatus.OK,
      message: 'Success',
      data: { status: 'ok' },
    });

    await request(httpServer()).get('/v1/health').expect(HttpStatus.NOT_FOUND);
  });
});

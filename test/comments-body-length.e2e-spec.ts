import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;
const MAX_COMMENT_BODY_LENGTH = 255;

describe('Comment body length (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let app: INestApplication<App>;
  let db: TestDatabase;
  let token: string;
  let username: string;
  let slug: string;

  beforeAll(async () => {
    db = await createTestDatabase('comment_body_length');
    app = await createTestApp(db);

    username = `comment_length_${suiteNonce}`;
    const registration = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `comment-length-${suiteNonce}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);
    token = registration.body.data.token as string;

    const article = await request(app.getHttpServer())
      .post('/v1/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Comment length ${suiteNonce}`,
        description: 'Comment length boundary',
        body: 'Article body',
      })
      .expect(HttpStatus.CREATED);
    slug = article.body.data.slug as string;
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await db.drop();
  }, HOOK_TIMEOUT_MS);

  it('accepts a comment body with exactly 255 characters', async () => {
    const body = 'x'.repeat(MAX_COMMENT_BODY_LENGTH);

    await request(app.getHttpServer())
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body })
      .expect(HttpStatus.CREATED)
      .expect(({ body: responseBody }) => {
        expect(responseBody.data.body).toBe(body);
      });
  });

  it('rejects a comment body with 256 characters', async () => {
    await request(app.getHttpServer())
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'x'.repeat(MAX_COMMENT_BODY_LENGTH + 1) })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body.errors.body).toBe('Body must be at most 255 characters');
      });
  });

  it('enforces the 255-character limit at the database boundary', async () => {
    const client = await db.client();
    const [author, article] = await Promise.all([
      client.user.findUniqueOrThrow({ where: { username } }),
      client.article.findUniqueOrThrow({ where: { slug } }),
    ]);

    await expect(
      client.comment.create({
        data: {
          articleId: article.id,
          authorId: author.id,
          body: 'x'.repeat(MAX_COMMENT_BODY_LENGTH + 1),
        },
      }),
    ).rejects.toThrow();
  });
});

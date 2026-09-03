import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Article comments (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('comments_http');
    app = await createTestApp(db);
    prisma = app.get(PrismaService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Comment HTTP e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  function database() {
    if (!prisma) {
      throw new Error('Comment e2e Prisma service is not initialized');
    }
    return prisma;
  }

  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const username = `comment_${role}_${fixtureId}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `comment-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return { token: response.body.data.token as string, username };
  }

  async function createArticle(token: string, title: string) {
    const response = await request(httpServer())
      .post('/v1/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({ title, description: 'Commentable article', body: 'Article body' })
      .expect(HttpStatus.CREATED);

    return response.body.data.slug as string;
  }

  it('creates a comment with its author profile', async () => {
    const author = await register('create');
    const slug = await createArticle(
      author.token,
      `Create comment ${suiteNonce}`,
    );

    const response = await request(httpServer())
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: 'A useful comment' })
      .expect(HttpStatus.CREATED);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.CREATED,
      message: 'Comment created successfully',
      data: {
        id: expect.any(Number),
        body: 'A useful comment',
        author: {
          username: author.username,
          bio: null,
          following: false,
        },
      },
    });
    expect(Object.keys(response.body.data).sort()).toEqual(
      ['id', 'createdAt', 'updatedAt', 'body', 'author'].sort(),
    );
    expect(Object.keys(response.body.data.author).sort()).toEqual(
      ['username', 'bio', 'image', 'following'].sort(),
    );
  });

  it('lists an article comments newest first', async () => {
    const author = await register('list');
    const slug = await createArticle(
      author.token,
      `List comments ${suiteNonce}`,
    );
    const first = await database().comment.create({
      data: {
        body: 'First comment',
        article: { connect: { slug } },
        author: { connect: { username: author.username } },
      },
    });
    const second = await database().comment.create({
      data: {
        body: 'Second comment',
        article: { connect: { slug } },
        author: { connect: { username: author.username } },
      },
    });

    const response = await request(httpServer())
      .get(`/v1/articles/${slug}/comments`)
      .expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Comments retrieved successfully',
      data: [
        { id: second.id, body: 'Second comment' },
        { id: first.id, body: 'First comment' },
      ],
    });
  });

  it('requires authentication and a non-blank comment body to create', async () => {
    const author = await register('validation');
    const slug = await createArticle(
      author.token,
      `Validate comments ${suiteNonce}`,
    );

    await request(httpServer())
      .post(`/v1/articles/${slug}/comments`)
      .send({ body: 'Unauthenticated comment' })
      .expect(HttpStatus.UNAUTHORIZED);

    await request(httpServer())
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: '   ' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Validation Error',
          errors: { body: 'Body must not be blank' },
        });
      });
  });

  it('allows only the comment author to delete it', async () => {
    const author = await register('owner');
    const other = await register('other');
    const slug = await createArticle(
      author.token,
      `Delete comments ${suiteNonce}`,
    );
    const created = await request(httpServer())
      .post(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: 'Delete me' })
      .expect(HttpStatus.CREATED);
    const commentId = created.body.data.id as number;

    await request(httpServer())
      .delete(`/v1/articles/${slug}/comments/${commentId}`)
      .expect(HttpStatus.UNAUTHORIZED);

    await request(httpServer())
      .delete(`/v1/articles/${slug}/comments/${commentId}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(HttpStatus.FORBIDDEN)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Only the comment author can delete this comment',
        });
      });

    await request(httpServer())
      .delete(`/v1/articles/${slug}/comments/${commentId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.OK,
          message: 'Comment deleted successfully',
          data: null,
        });
      });

    await expect(
      database().comment.findUnique({ where: { id: commentId } }),
    ).resolves.toBeNull();
  });

  it('returns 404 for an absent article or a comment from another article', async () => {
    const author = await register('not_found');
    const firstSlug = await createArticle(
      author.token,
      `First comments ${suiteNonce}`,
    );
    const secondSlug = await createArticle(
      author.token,
      `Second comments ${suiteNonce}`,
    );
    const created = await request(httpServer())
      .post(`/v1/articles/${firstSlug}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: 'Attached to first article' })
      .expect(HttpStatus.CREATED);

    await request(httpServer())
      .get(`/v1/articles/missing-${suiteNonce}/comments`)
      .expect(HttpStatus.NOT_FOUND);

    await request(httpServer())
      .delete(
        `/v1/articles/${secondSlug}/comments/${created.body.data.id as number}`,
      )
      .set('Authorization', `Bearer ${author.token}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns correct author.following when authenticated viewer follows comment author', async () => {
    const author = await register('cauthor');
    const viewer = await register('viewer');
    const slug = await createArticle(
      author.token,
      `Followed comment ${suiteNonce}`,
    );
    await database().comment.create({
      data: {
        body: 'Comment from followed author',
        article: { connect: { slug } },
        author: { connect: { username: author.username } },
      },
    });

    const anonRes = await request(httpServer())
      .get(`/v1/articles/${slug}/comments`)
      .expect(HttpStatus.OK);
    expect(anonRes.body.data[0].author.following).toBe(false);

    const viewerUnfollowedRes = await request(httpServer())
      .get(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(HttpStatus.OK);
    expect(viewerUnfollowedRes.body.data[0].author.following).toBe(false);

    await request(httpServer())
      .post(`/v1/profiles/${author.username}/follow`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(HttpStatus.OK);

    const viewerFollowedRes = await request(httpServer())
      .get(`/v1/articles/${slug}/comments`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(HttpStatus.OK);
    expect(viewerFollowedRes.body.data[0].author.following).toBe(true);
  });
});

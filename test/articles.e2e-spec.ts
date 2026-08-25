import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  HttpStatus,
  INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ArticleSlugService } from '../src/articles/article-slug.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Article CRUD (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('articles_http');
    app = await createTestApp(db);
    prisma = app.get(PrismaService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Article HTTP e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  function database() {
    if (!prisma) {
      throw new Error('Article HTTP e2e database is not initialized');
    }
    return prisma;
  }

  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const username = `article_${role}_${fixtureId}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `article-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    expect(response.body).toMatchObject({
      statusCode: HttpStatus.CREATED,
      message: 'User registered successfully',
      data: { username },
    });

    return {
      token: response.body.data.token as string,
      username,
    };
  }

  async function createArticle(
    token: string,
    title: string,
    overrides: Record<string, unknown> = {},
  ) {
    return request(httpServer())
      .post('/v1/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title,
        description: 'Description',
        body: 'Body',
        ...overrides,
      })
      .expect(HttpStatus.CREATED);
  }

  it('creates, reads, updates tag variants and title, then deletes an owned article', async () => {
    const owner = await register('crud');
    const nestTag = `nestjs-${suiteNonce}`;
    const prismaTag = `prisma-${suiteNonce}`;
    const replacementTag = `replacement-${suiteNonce}`;
    const finalTag = `updated-${suiteNonce}`;
    const created = await createArticle(owner.token, 'Hướng dẫn NestJS', {
      description: ' Description ',
      body: 'Body\n',
      tagList: [
        ` ${nestTag.toUpperCase()} `,
        nestTag,
        '',
        prismaTag.toUpperCase(),
      ],
    });

    expect(created.body).toMatchObject({
      statusCode: HttpStatus.CREATED,
      message: 'Article created successfully',
      data: {
        slug: 'huong-dan-nestjs',
        title: 'Hướng dẫn NestJS',
        description: 'Description',
        body: 'Body\n',
        tagList: [nestTag, prismaTag],
        favorited: false,
        favoritesCount: 0,
        author: {
          username: owner.username,
          bio: null,
          following: false,
        },
      },
    });
    expect(Object.keys(created.body.data).sort()).toEqual(
      [
        'author',
        'body',
        'createdAt',
        'description',
        'favorited',
        'favoritesCount',
        'slug',
        'tagList',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(created.body.data.author).sort()).toEqual(
      ['bio', 'following', 'image', 'username'].sort(),
    );
    expect(
      created.body.data.author.image === null ||
        typeof created.body.data.author.image === 'string',
    ).toBe(true);
    expect(new Date(created.body.data.createdAt).toISOString()).toBe(
      created.body.data.createdAt,
    );
    expect(new Date(created.body.data.updatedAt).toISOString()).toBe(
      created.body.data.updatedAt,
    );

    const fetched = await request(httpServer())
      .get('/v1/articles/huong-dan-nestjs')
      .expect(HttpStatus.OK);
    expect(fetched.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article retrieved successfully',
      data: created.body.data,
    });

    const preserved = await request(httpServer())
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ body: 'Body changed' })
      .expect(HttpStatus.OK);
    expect(preserved.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article updated successfully',
      data: { body: 'Body changed', tagList: [nestTag, prismaTag] },
    });

    const replaced = await request(httpServer())
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ tagList: [replacementTag] })
      .expect(HttpStatus.OK);
    expect(replaced.body.data.tagList).toEqual([replacementTag]);

    const cleared = await request(httpServer())
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ tagList: [] })
      .expect(HttpStatus.OK);
    expect(cleared.body.data.tagList).toEqual([]);

    const updated = await request(httpServer())
      .put('/v1/articles/huong-dan-nestjs')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Updated Article', tagList: [finalTag] })
      .expect(HttpStatus.OK);
    expect(updated.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Article updated successfully',
      data: { slug: 'updated-article', tagList: [finalTag] },
    });

    await request(httpServer())
      .get('/v1/articles/huong-dan-nestjs')
      .expect(HttpStatus.NOT_FOUND)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Article not found',
        });
      });

    await request(httpServer())
      .delete('/v1/articles/updated-article')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(HttpStatus.OK)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.OK,
          message: 'Article deleted successfully',
          data: null,
        });
      });

    await request(httpServer())
      .get('/v1/articles/updated-article')
      .expect(HttpStatus.NOT_FOUND);
    await expect(
      database().tag.findUnique({ where: { name: finalTag } }),
    ).resolves.not.toBeNull();
  });

  it('requires authentication for every mutation route', async () => {
    const payload = {
      title: `Unauthorized ${suiteNonce}`,
      description: 'Description',
      body: 'Body',
    };

    await request(httpServer())
      .post('/v1/articles')
      .send(payload)
      .expect(HttpStatus.UNAUTHORIZED);
    await request(httpServer())
      .put(`/v1/articles/unauthorized-${suiteNonce}`)
      .send({ title: 'Forbidden without token' })
      .expect(HttpStatus.UNAUTHORIZED);
    await request(httpServer())
      .delete(`/v1/articles/unauthorized-${suiteNonce}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('forbids a non-author from updating or deleting an article', async () => {
    const owner = await register('owner');
    const other = await register('other');
    const slug = `ownership-${suiteNonce}`;
    await createArticle(owner.token, `Ownership ${suiteNonce}`);

    await request(httpServer())
      .put(`/v1/articles/${slug}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Forbidden update' })
      .expect(HttpStatus.FORBIDDEN)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Only the author can modify this article',
        });
      });

    await request(httpServer())
      .delete(`/v1/articles/${slug}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(HttpStatus.FORBIDDEN)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Only the author can modify this article',
        });
      });
  });

  it('returns 404 for read, update and delete of a missing slug', async () => {
    const owner = await register('missing');
    const missingSlug = `missing-${suiteNonce}`;

    await request(httpServer())
      .get(`/v1/articles/${missingSlug}`)
      .expect(HttpStatus.NOT_FOUND);
    await request(httpServer())
      .put(`/v1/articles/${missingSlug}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Still missing' })
      .expect(HttpStatus.NOT_FOUND);
    await request(httpServer())
      .delete(`/v1/articles/${missingSlug}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('returns 422 for DTO violations and an empty update', async () => {
    const owner = await register('validation');
    const slug = `validation-${suiteNonce}`;

    const invalidCreate = await request(httpServer())
      .post('/v1/articles')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        title: '   ',
        description: 'Description',
        body: 'Body',
        tagList: null,
      })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(invalidCreate.body).toMatchObject({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Validation Error',
      errors: {
        title: 'Title must not be blank',
        tagList: 'Tag is invalid',
      },
    });

    await createArticle(owner.token, `Validation ${suiteNonce}`);

    const invalidUpdate = await request(httpServer())
      .put(`/v1/articles/${slug}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ description: '   ' })
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(invalidUpdate.body).toMatchObject({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: 'Validation Error',
      errors: { description: 'Description must not be blank' },
    });

    await request(httpServer())
      .put(`/v1/articles/${slug}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(HttpStatus.UNPROCESSABLE_ENTITY)
      .expect(({ body }) => {
        expect(body).toEqual({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Provide at least one article field to update',
        });
      });
  });

  it('allocates deterministic numeric suffixes for duplicate titles', async () => {
    const owner = await register('duplicates');
    const title = `Duplicate Runtime ${suiteNonce}`;
    const baseSlug = `duplicate-runtime-${suiteNonce}`;

    const first = await createArticle(owner.token, title);
    const second = await createArticle(owner.token, title);
    const third = await createArticle(owner.token, title);

    expect(first.body.data.slug).toBe(baseSlug);
    expect(second.body.data.slug).toBe(`${baseSlug}-2`);
    expect(third.body.data.slug).toBe(`${baseSlug}-3`);
  });

  it('maps a localized slug conflict to the exact 409 HTTP envelope (filter mapping only)', async () => {
    const owner = await register('conflict');
    const title = `HTTP Conflict ${suiteNonce}`;
    const slugService = app?.get(ArticleSlugService);
    if (!slugService) {
      throw new Error('ArticleSlugService is not available from AppModule');
    }
    const articlesBefore = await database().article.count({
      where: { title },
    });
    const executeSpy = jest
      .spyOn(slugService, 'execute')
      .mockRejectedValueOnce(
        new ConflictException('Could not allocate a unique article slug'),
      );

    try {
      await request(httpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title, description: 'Description', body: 'Body' })
        .expect(HttpStatus.CONFLICT)
        .expect(({ body }) => {
          expect(body).toEqual({
            statusCode: HttpStatus.CONFLICT,
            message: 'Could not allocate a unique article slug',
          });
        });

      expect(executeSpy).toHaveBeenCalledTimes(1);
      await expect(
        database().article.count({ where: { title } }),
      ).resolves.toBe(articlesBefore);
    } finally {
      executeSpy.mockRestore();
    }
  });
});

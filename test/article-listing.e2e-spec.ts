import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;
const SEED_EPOCH = Date.parse('2026-01-01T00:00:00.000Z');

describe('Article listing and feed (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let prisma: PrismaService | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('article_listing');
    app = await createTestApp(db);
    prisma = app.get(PrismaService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Article listing e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  function database() {
    if (!prisma) {
      throw new Error('Article listing e2e database is not initialized');
    }
    return prisma;
  }

  /** Registers over HTTP so the token is real, then reads the id back. */
  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const username = `listing_${role}_${fixtureId}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `listing-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);
    const user = await database().user.findUniqueOrThrow({
      where: { username },
      select: { id: true },
    });

    return { token: response.body.data.token as string, username, id: user.id };
  }

  /**
   * Seeds through Prisma rather than the HTTP endpoint so createdAt is explicit.
   * Rows created in a loop can share a timestamp, which would make the page
   * assertions below depend on how fast the loop ran.
   */
  async function seedArticles(
    authorId: number,
    slugs: string[],
    extra: { tags?: string[]; favoritedByUserId?: number } = {},
  ) {
    for (const [index, slug] of slugs.entries()) {
      await database().article.create({
        data: {
          slug,
          title: slug,
          description: 'Description',
          body: 'Body',
          createdAt: new Date(SEED_EPOCH + index * 1000),
          author: { connect: { id: authorId } },
          ...(extra.tags === undefined
            ? {}
            : {
                tagList: {
                  connectOrCreate: extra.tags.map((name) => ({
                    where: { name },
                    create: { name },
                  })),
                },
              }),
          ...(extra.favoritedByUserId === undefined
            ? {}
            : { favoritedBy: { connect: { id: extra.favoritedByUserId } } }),
        },
      });
    }
  }

  it('pages newest first and reports meta on every page', async () => {
    const author = await register('pager');
    const slugs = Array.from({ length: 5 }, (_, i) => `pg-${suiteNonce}-${i}`);
    await seedArticles(author.id, slugs);

    const first = await request(httpServer())
      .get(`/v1/articles?author=${author.username}&page=1&limit=2`)
      .expect(HttpStatus.OK);
    const last = await request(httpServer())
      .get(`/v1/articles?author=${author.username}&page=3&limit=2`)
      .expect(HttpStatus.OK);
    const past = await request(httpServer())
      .get(`/v1/articles?author=${author.username}&page=9&limit=2`)
      .expect(HttpStatus.OK);

    expect(first.body).toMatchObject({
      statusCode: HttpStatus.OK,
      message: 'Articles retrieved successfully',
      meta: {
        total: 5,
        page: 1,
        last_page: 3,
        limit: 2,
        has_next_page: true,
        has_prev_page: false,
      },
    });
    expect(first.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      slugs[4],
      slugs[3],
    ]);
    expect(last.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      slugs[0],
    ]);
    expect(last.body.meta).toMatchObject({ has_next_page: false });
    expect(past.body.data).toEqual([]);
    expect(past.body.meta).toMatchObject({ total: 5, page: 9 });
  });

  it('keeps the documented article shape and the deferred flags', async () => {
    const author = await register('shape');
    await seedArticles(author.id, [`shape-${suiteNonce}`]);

    const response = await request(httpServer())
      .get(`/v1/articles?author=${author.username}`)
      .expect(HttpStatus.OK);

    expect(response.body.data[0]).toMatchObject({
      slug: `shape-${suiteNonce}`,
      favorited: false,
      author: { username: author.username, following: false },
    });
    expect(Object.keys(response.body.data[0]).sort()).toEqual(
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
  });

  // Both article read paths resolve `following` through buildArticleSelect(viewerId).
  // Only a real query proves the relation Prisma returns is the one the mapper reads.
  it('resolves author.following per viewer on the list and single-article paths', async () => {
    const author = await register('fauthor');
    const follower = await register('follower');
    const stranger = await register('outsider');
    const slug = `following-${suiteNonce}`;
    await seedArticles(author.id, [slug]);
    await request(httpServer())
      .post(`/v1/profiles/${author.username}/follow`)
      .set('Authorization', `Bearer ${follower.token}`)
      .expect(HttpStatus.OK);

    const listAsFollower = await request(httpServer())
      .get(`/v1/articles?author=${author.username}`)
      .set('Authorization', `Bearer ${follower.token}`)
      .expect(HttpStatus.OK);
    const listAsStranger = await request(httpServer())
      .get(`/v1/articles?author=${author.username}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .expect(HttpStatus.OK);
    const listAnonymous = await request(httpServer())
      .get(`/v1/articles?author=${author.username}`)
      .expect(HttpStatus.OK);
    const oneAsFollower = await request(httpServer())
      .get(`/v1/articles/${slug}`)
      .set('Authorization', `Bearer ${follower.token}`)
      .expect(HttpStatus.OK);
    const oneAnonymous = await request(httpServer())
      .get(`/v1/articles/${slug}`)
      .expect(HttpStatus.OK);

    expect(listAsFollower.body.data[0].author.following).toBe(true);
    expect(listAsStranger.body.data[0].author.following).toBe(false);
    expect(listAnonymous.body.data[0].author.following).toBe(false);
    expect(oneAsFollower.body.data.author.following).toBe(true);
    expect(oneAnonymous.body.data.author.following).toBe(false);
  });

  it('filters by tag case-insensitively and by the user who favorited', async () => {
    const author = await register('filters');
    const fan = await register('fan');
    const tag = `tag-${suiteNonce}`;
    await seedArticles(author.id, [`tagged-${suiteNonce}`], { tags: [tag] });
    await seedArticles(author.id, [`faved-${suiteNonce}`], {
      favoritedByUserId: fan.id,
    });

    const byTag = await request(httpServer())
      .get(`/v1/articles?tag=${tag.toUpperCase()}`)
      .expect(HttpStatus.OK);
    const byFavorited = await request(httpServer())
      .get(`/v1/articles?favorited=${fan.username}`)
      .expect(HttpStatus.OK);
    const combined = await request(httpServer())
      .get(`/v1/articles?tag=${tag}&author=${author.username}`)
      .expect(HttpStatus.OK);

    expect(byTag.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      `tagged-${suiteNonce}`,
    ]);
    expect(byFavorited.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      `faved-${suiteNonce}`,
    ]);
    expect(combined.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      `tagged-${suiteNonce}`,
    ]);
  });

  it('answers an unmatched filter with an empty page, not 404', async () => {
    const response = await request(httpServer())
      .get(`/v1/articles?author=absent_${suiteNonce}`)
      .expect(HttpStatus.OK);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toMatchObject({ total: 0, last_page: 0 });
  });

  it('rejects a limit above the cap and a page below one', async () => {
    await request(httpServer())
      .get('/v1/articles?limit=101')
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await request(httpServer())
      .get('/v1/articles?page=0')
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await request(httpServer())
      .get('/v1/articles?limit=100')
      .expect(HttpStatus.OK);
  });

  // Declaration order in the controller decides this. With ':slug' first the
  // request resolves as an article named "feed" and answers 404.
  it('routes /articles/feed to the feed handler, not the slug handler', async () => {
    const reader = await register('router');

    const response = await request(httpServer())
      .get('/v1/articles/feed')
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(HttpStatus.OK);

    expect(response.body.message).toBe('Feed retrieved successfully');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('returns only articles by followed authors, excluding own and unfollowed', async () => {
    const reader = await register('reader');
    const followed = await register('followed');
    const stranger = await register('stranger');
    await database().user.update({
      where: { id: reader.id },
      data: { following: { connect: { id: followed.id } } },
    });
    await seedArticles(followed.id, [
      `feed-a-${suiteNonce}`,
      `feed-b-${suiteNonce}`,
    ]);
    await seedArticles(stranger.id, [`feed-stranger-${suiteNonce}`]);
    await seedArticles(reader.id, [`feed-own-${suiteNonce}`]);

    const response = await request(httpServer())
      .get('/v1/articles/feed?page=1&limit=1')
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(HttpStatus.OK);

    expect(response.body.data.map((a: { slug: string }) => a.slug)).toEqual([
      `feed-b-${suiteNonce}`,
    ]);
    expect(response.body.data[0].author.following).toBe(true);
    expect(response.body.meta).toMatchObject({
      total: 2,
      last_page: 2,
      has_next_page: true,
    });
  });

  it('rejects the feed without a bearer token', async () => {
    await request(httpServer())
      .get('/v1/articles/feed')
      .expect(HttpStatus.UNAUTHORIZED);
  });
});

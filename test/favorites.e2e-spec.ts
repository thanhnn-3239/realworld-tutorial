import { randomBytes } from 'node:crypto';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './support/test-app';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('Article favorites (e2e)', () => {
  const suiteNonce = randomBytes(5).toString('hex');
  let db: TestDatabase | undefined;
  let app: INestApplication<App> | undefined;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('favorites_http');
    app = await createTestApp(db);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  function httpServer() {
    if (!app) {
      throw new Error('Favorites HTTP e2e application is not initialized');
    }
    return app.getHttpServer();
  }

  /** Keep `role` short: username max length is 30. */
  async function register(role: string) {
    fixtureNumber += 1;
    const fixtureId = `${suiteNonce}${fixtureNumber}`;
    const username = `fav_${role}_${fixtureId}`;
    const response = await request(httpServer())
      .post('/v1/auth/register')
      .send({
        email: `fav-e2e-${role}-${fixtureId}@example.com`,
        username,
        password: 'password123',
        password_confirmation: 'password123',
      })
      .expect(HttpStatus.CREATED);

    return { token: response.body.data.token as string, username };
  }

  async function createArticle(token: string) {
    fixtureNumber += 1;
    const response = await request(httpServer())
      .post('/v1/articles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Favorite me ${suiteNonce}${fixtureNumber}`,
        description: 'Description',
        body: 'Body',
      })
      .expect(HttpStatus.CREATED);

    return response.body.data.slug as string;
  }

  function favorite(slug: string, token?: string) {
    const call = request(httpServer()).post(`/v1/articles/${slug}/favorite`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  }

  function unfavorite(slug: string, token?: string) {
    const call = request(httpServer()).delete(`/v1/articles/${slug}/favorite`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  }

  function expectFlags(
    response: request.Response,
    favorited: boolean,
    favoritesCount: number,
  ) {
    expect(response.body.data).toMatchObject({ favorited, favoritesCount });
  }

  describe('authentication and existence', () => {
    it('rejects favorite and unfavorite without a token', async () => {
      const author = await register('author');
      const slug = await createArticle(author.token);

      await favorite(slug).expect(HttpStatus.UNAUTHORIZED);
      await unfavorite(slug).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects a malformed token', async () => {
      const author = await register('author');
      const slug = await createArticle(author.token);

      await favorite(slug, 'not-a-real-token').expect(HttpStatus.UNAUTHORIZED);
      await unfavorite(slug, 'not-a-real-token').expect(
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('answers 404 for an unknown slug on both verbs', async () => {
      const fan = await register('fan');
      const missing = `no-such-article-${suiteNonce}`;

      await favorite(missing, fan.token).expect(HttpStatus.NOT_FOUND);
      await unfavorite(missing, fan.token).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('favorite and unfavorite', () => {
    it('favorites an article and reports the new count', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);

      const response = await favorite(slug, fan.token).expect(HttpStatus.OK);

      expect(response.body.message).toBe('Article favorited successfully');
      expectFlags(response, true, 1);
    });

    it('is idempotent: favoriting twice does not double the count', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);

      await favorite(slug, fan.token).expect(HttpStatus.OK);
      const second = await favorite(slug, fan.token).expect(HttpStatus.OK);

      expectFlags(second, true, 1);
    });

    it('unfavorites an article and reports the new count', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);
      await favorite(slug, fan.token).expect(HttpStatus.OK);

      const response = await unfavorite(slug, fan.token).expect(HttpStatus.OK);

      expect(response.body.message).toBe('Article unfavorited successfully');
      expectFlags(response, false, 0);
    });

    it('is idempotent: unfavoriting twice stays 200 with count 0', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);
      await favorite(slug, fan.token).expect(HttpStatus.OK);

      await unfavorite(slug, fan.token).expect(HttpStatus.OK);
      const second = await unfavorite(slug, fan.token).expect(HttpStatus.OK);

      expectFlags(second, false, 0);
    });

    it('permits unfavoriting an article that was never favorited', async () => {
      const author = await register('author');
      const stranger = await register('other');
      const slug = await createArticle(author.token);

      const response = await unfavorite(slug, stranger.token).expect(
        HttpStatus.OK,
      );

      expectFlags(response, false, 0);
    });

    it('permits favoriting your own article, unlike self-follow', async () => {
      const author = await register('author');
      const slug = await createArticle(author.token);

      const response = await favorite(slug, author.token).expect(HttpStatus.OK);

      expectFlags(response, true, 1);
    });
  });

  describe('the flag is per viewer, the count is global', () => {
    it('scopes favorited to the bearer token while the count stays shared', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const other = await register('other');
      const slug = await createArticle(author.token);
      await favorite(slug, fan.token).expect(HttpStatus.OK);

      const asFan = await request(httpServer())
        .get(`/v1/articles/${slug}`)
        .set('Authorization', `Bearer ${fan.token}`)
        .expect(HttpStatus.OK);
      const asOther = await request(httpServer())
        .get(`/v1/articles/${slug}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(HttpStatus.OK);
      const anonymous = await request(httpServer())
        .get(`/v1/articles/${slug}`)
        .expect(HttpStatus.OK);

      expectFlags(asFan, true, 1);
      expectFlags(asOther, false, 1);
      expectFlags(anonymous, false, 1);
    });
  });

  describe('every read path resolves the flag', () => {
    it('resolves favorited on the article list', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);
      await favorite(slug, fan.token).expect(HttpStatus.OK);

      const response = await request(httpServer())
        .get(`/v1/articles?author=${author.username}`)
        .set('Authorization', `Bearer ${fan.token}`)
        .expect(HttpStatus.OK);

      const article = response.body.data.find(
        (item: { slug: string }) => item.slug === slug,
      );
      expect(article).toMatchObject({ favorited: true, favoritesCount: 1 });
    });

    it('resolves favorited on the feed', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const slug = await createArticle(author.token);
      await request(httpServer())
        .post(`/v1/profiles/${author.username}/follow`)
        .set('Authorization', `Bearer ${fan.token}`)
        .expect(HttpStatus.OK);
      await favorite(slug, fan.token).expect(HttpStatus.OK);

      const response = await request(httpServer())
        .get('/v1/articles/feed')
        .set('Authorization', `Bearer ${fan.token}`)
        .expect(HttpStatus.OK);

      const article = response.body.data.find(
        (item: { slug: string }) => item.slug === slug,
      );
      expect(article).toMatchObject({ favorited: true, favoritesCount: 1 });
    });

    it('resolves favorited on the update response for a self-favorited article', async () => {
      const author = await register('author');
      const slug = await createArticle(author.token);
      await favorite(slug, author.token).expect(HttpStatus.OK);

      const response = await request(httpServer())
        .put(`/v1/articles/${slug}`)
        .set('Authorization', `Bearer ${author.token}`)
        .send({ body: 'Updated body' })
        .expect(HttpStatus.OK);

      expectFlags(response, true, 1);
    });

    it('still reports favorited: false on a freshly created article', async () => {
      const author = await register('author');
      fixtureNumber += 1;

      const response = await request(httpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${author.token}`)
        .send({
          title: `Brand new ${suiteNonce}${fixtureNumber}`,
          description: 'Description',
          body: 'Body',
        })
        .expect(HttpStatus.CREATED);

      expectFlags(response, false, 0);
    });
  });

  describe('regression: the favorited filter', () => {
    it('still filters the list by the user who favorited', async () => {
      const author = await register('author');
      const fan = await register('fan');
      const favoritedSlug = await createArticle(author.token);
      const untouchedSlug = await createArticle(author.token);
      await favorite(favoritedSlug, fan.token).expect(HttpStatus.OK);

      const response = await request(httpServer())
        .get(`/v1/articles?favorited=${fan.username}`)
        .expect(HttpStatus.OK);

      const slugs = response.body.data.map(
        (item: { slug: string }) => item.slug,
      );
      expect(slugs).toContain(favoritedSlug);
      expect(slugs).not.toContain(untouchedSlug);
    });
  });
});

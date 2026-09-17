import { HttpStatus } from '@nestjs/common';
import type request from 'supertest';

import { createArticleViaApi } from './support/article-test-helpers';
import { useE2eSuite } from './support/e2e-suite';

describe('Article favorites (e2e)', () => {
  const e2e = useE2eSuite('favorites');

  async function createArticle(authorization: string, title = 'Favorite me') {
    const response = await createArticleViaApi(e2e, authorization, title);
    return response.body.data.slug as string;
  }

  function favorite(slug: string, authorization?: string) {
    const call = e2e.request.post(`/v1/articles/${slug}/favorite`);
    return authorization ? call.set('Authorization', authorization) : call;
  }

  function unfavorite(slug: string, authorization?: string) {
    const call = e2e.request.delete(`/v1/articles/${slug}/favorite`);
    return authorization ? call.set('Authorization', authorization) : call;
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
      const author = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      await favorite(slug).expect(HttpStatus.UNAUTHORIZED);
      await unfavorite(slug).expect(HttpStatus.UNAUTHORIZED);
    });

    it('rejects a malformed token', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      await favorite(slug, 'Bearer not-a-real-token').expect(
        HttpStatus.UNAUTHORIZED,
      );
      await unfavorite(slug, 'Bearer not-a-real-token').expect(
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('answers 404 for an unknown slug on both verbs', async () => {
      const fan = await e2e.fixtures.authenticatedUser();

      await favorite('no-such-article', fan.authorization).expect(
        HttpStatus.NOT_FOUND,
      );
      await unfavorite('no-such-article', fan.authorization).expect(
        HttpStatus.NOT_FOUND,
      );
    });
  });

  describe('favorite and unfavorite', () => {
    it('favorites an article and reports the new count', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      const response = await favorite(slug, fan.authorization).expect(
        HttpStatus.OK,
      );

      expect(response.body.message).toBe('Article favorited successfully');
      expectFlags(response, true, 1);
    });

    it('is idempotent: favoriting twice does not double the count', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      await favorite(slug, fan.authorization).expect(HttpStatus.OK);
      const second = await favorite(slug, fan.authorization).expect(
        HttpStatus.OK,
      );

      expectFlags(second, true, 1);
    });

    it('unfavorites an article and reports the new count', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await favorite(slug, fan.authorization).expect(HttpStatus.OK);

      const response = await unfavorite(slug, fan.authorization).expect(
        HttpStatus.OK,
      );

      expect(response.body.message).toBe('Article unfavorited successfully');
      expectFlags(response, false, 0);
    });

    it('is idempotent: unfavoriting twice stays 200 with count 0', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await favorite(slug, fan.authorization).expect(HttpStatus.OK);

      await unfavorite(slug, fan.authorization).expect(HttpStatus.OK);
      const second = await unfavorite(slug, fan.authorization).expect(
        HttpStatus.OK,
      );

      expectFlags(second, false, 0);
    });

    it('permits unfavoriting an article that was never favorited', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const stranger = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      const response = await unfavorite(slug, stranger.authorization).expect(
        HttpStatus.OK,
      );

      expectFlags(response, false, 0);
    });

    it('permits favoriting your own article, unlike self-follow', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);

      const response = await favorite(slug, author.authorization).expect(
        HttpStatus.OK,
      );

      expectFlags(response, true, 1);
    });
  });

  describe('the flag is per viewer, the count is global', () => {
    it('scopes favorited to the bearer token while the count stays shared', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const other = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await favorite(slug, fan.authorization).expect(HttpStatus.OK);

      const asFan = await e2e.request
        .get(`/v1/articles/${slug}`)
        .set('Authorization', fan.authorization)
        .expect(HttpStatus.OK);
      const asOther = await e2e.request
        .get(`/v1/articles/${slug}`)
        .set('Authorization', other.authorization)
        .expect(HttpStatus.OK);
      const anonymous = await e2e.request
        .get(`/v1/articles/${slug}`)
        .expect(HttpStatus.OK);

      expectFlags(asFan, true, 1);
      expectFlags(asOther, false, 1);
      expectFlags(anonymous, false, 1);
    });
  });

  describe('every read path resolves the flag', () => {
    it('resolves favorited on the article list', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await favorite(slug, fan.authorization).expect(HttpStatus.OK);

      const response = await e2e.request
        .get(`/v1/articles?author=${author.username}`)
        .set('Authorization', fan.authorization)
        .expect(HttpStatus.OK);

      const article = response.body.data.find(
        (item: { slug: string }) => item.slug === slug,
      );
      expect(article).toMatchObject({ favorited: true, favoritesCount: 1 });
    });

    it('resolves favorited on the feed', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await e2e.prisma.user.update({
        where: { id: fan.id },
        data: { following: { connect: { id: author.id } } },
      });
      await favorite(slug, fan.authorization).expect(HttpStatus.OK);

      const response = await e2e.request
        .get('/v1/articles/feed')
        .set('Authorization', fan.authorization)
        .expect(HttpStatus.OK);

      const article = response.body.data.find(
        (item: { slug: string }) => item.slug === slug,
      );
      expect(article).toMatchObject({ favorited: true, favoritesCount: 1 });
    });

    it('resolves favorited on the update response for a self-favorited article', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const slug = await createArticle(author.authorization);
      await favorite(slug, author.authorization).expect(HttpStatus.OK);

      const response = await e2e.request
        .put(`/v1/articles/${slug}`)
        .set('Authorization', author.authorization)
        .send({ body: 'Updated body' })
        .expect(HttpStatus.OK);

      expectFlags(response, true, 1);
    });

    it('still reports favorited: false on a freshly created article', async () => {
      const author = await e2e.fixtures.authenticatedUser();

      const response = await createArticleViaApi(
        e2e,
        author.authorization,
        'Brand new',
      );

      expectFlags(response, false, 0);
    });
  });

  describe('regression: the favorited filter', () => {
    it('still filters the list by the user who favorited', async () => {
      const author = await e2e.fixtures.authenticatedUser();
      const fan = await e2e.fixtures.authenticatedUser();
      const favoritedSlug = await createArticle(author.authorization, 'Chosen');
      const untouchedSlug = await createArticle(
        author.authorization,
        'Ignored',
      );
      await favorite(favoritedSlug, fan.authorization).expect(HttpStatus.OK);

      const response = await e2e.request
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

import { HttpStatus } from '@nestjs/common';

import { seedArticles } from './support/article-listing-fixtures';
import { useE2eSuite } from './support/e2e-suite';

describe('Article list filters (e2e)', () => {
  const e2e = useE2eSuite('article-list-filters');

  it('resolves author.following for list and single-article responses', async () => {
    const author = await e2e.fixtures.user({ username: 'followed_author' });
    const follower = await e2e.fixtures.authenticatedUser();
    const stranger = await e2e.fixtures.authenticatedUser();
    await seedArticles(e2e, author.id, ['following']);
    await e2e.request
      .post(`/v1/profiles/${author.username}/follow`)
      .set('Authorization', follower.authorization)
      .expect(HttpStatus.OK);

    const listAsFollower = await e2e.request
      .get(`/v1/articles?author=${author.username}`)
      .set('Authorization', follower.authorization)
      .expect(HttpStatus.OK);
    const listAsStranger = await e2e.request
      .get(`/v1/articles?author=${author.username}`)
      .set('Authorization', stranger.authorization)
      .expect(HttpStatus.OK);
    const listAnonymous = await e2e.request
      .get(`/v1/articles?author=${author.username}`)
      .expect(HttpStatus.OK);
    const oneAsFollower = await e2e.request
      .get('/v1/articles/following')
      .set('Authorization', follower.authorization)
      .expect(HttpStatus.OK);
    const oneAnonymous = await e2e.request
      .get('/v1/articles/following')
      .expect(HttpStatus.OK);

    expect(listAsFollower.body.data[0].author.following).toBe(true);
    expect(listAsStranger.body.data[0].author.following).toBe(false);
    expect(listAnonymous.body.data[0].author.following).toBe(false);
    expect(oneAsFollower.body.data.author.following).toBe(true);
    expect(oneAnonymous.body.data.author.following).toBe(false);
  });

  it('filters by tag case-insensitively and by favoriting user', async () => {
    const author = await e2e.fixtures.user({ username: 'filter_author' });
    const fan = await e2e.fixtures.user({ username: 'filter_fan' });
    await seedArticles(e2e, author.id, ['tagged'], { tags: ['featured'] });
    await seedArticles(e2e, author.id, ['favorited'], {
      favoritedByUserId: fan.id,
    });

    const byTag = await e2e.request
      .get('/v1/articles?tag=FEATURED')
      .expect(HttpStatus.OK);
    const byFavorited = await e2e.request
      .get(`/v1/articles?favorited=${fan.username}`)
      .expect(HttpStatus.OK);
    const combined = await e2e.request
      .get(`/v1/articles?tag=featured&author=${author.username}`)
      .expect(HttpStatus.OK);

    expect(
      byTag.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual(['tagged']);
    expect(
      byFavorited.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual(['favorited']);
    expect(
      combined.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual(['tagged']);
  });
});

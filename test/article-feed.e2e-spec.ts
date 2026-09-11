import { HttpStatus } from '@nestjs/common';

import { seedArticles } from './support/article-listing-fixtures';
import { useE2eSuite } from './support/e2e-suite';

describe('Article feed (e2e)', () => {
  const e2e = useE2eSuite('article-feed');

  it('routes /articles/feed to the feed handler', async () => {
    const reader = await e2e.fixtures.authenticatedUser();

    const response = await e2e.request
      .get('/v1/articles/feed')
      .set('Authorization', reader.authorization)
      .expect(HttpStatus.OK);

    expect(response.body.message).toBe('Feed retrieved successfully');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('returns only articles by followed authors', async () => {
    const reader = await e2e.fixtures.authenticatedUser();
    const followed = await e2e.fixtures.user();
    const stranger = await e2e.fixtures.user();
    await e2e.prisma.user.update({
      where: { id: reader.id },
      data: { following: { connect: { id: followed.id } } },
    });
    await seedArticles(e2e, followed.id, ['feed-a', 'feed-b']);
    await seedArticles(e2e, stranger.id, ['feed-stranger']);
    await seedArticles(e2e, reader.id, ['feed-own']);

    const response = await e2e.request
      .get('/v1/articles/feed?page=1&limit=1')
      .set('Authorization', reader.authorization)
      .expect(HttpStatus.OK);

    expect(
      response.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual(['feed-b']);
    expect(response.body.data[0].author.following).toBe(true);
    expect(response.body.meta).toMatchObject({
      total: 2,
      last_page: 2,
      has_next_page: true,
    });
  });

  it('rejects the feed without a bearer token', async () => {
    await e2e.request.get('/v1/articles/feed').expect(HttpStatus.UNAUTHORIZED);
  });
});

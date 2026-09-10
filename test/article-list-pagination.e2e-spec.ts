import { HttpStatus } from '@nestjs/common';

import { seedArticles } from './support/article-listing-fixtures';
import { useE2eSuite } from './support/e2e-suite';

describe('Article list pagination (e2e)', () => {
  const e2e = useE2eSuite('article-list-pagination');

  it('pages newest first and reports meta on every page', async () => {
    const author = await e2e.fixtures.user({ username: 'page_author' });
    const slugs = Array.from({ length: 5 }, (_, index) => `page-${index}`);
    await seedArticles(e2e, author.id, slugs);

    const first = await e2e.request
      .get(`/v1/articles?author=${author.username}&page=1&limit=2`)
      .expect(HttpStatus.OK);
    const last = await e2e.request
      .get(`/v1/articles?author=${author.username}&page=3&limit=2`)
      .expect(HttpStatus.OK);
    const past = await e2e.request
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
    expect(
      first.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual([slugs[4], slugs[3]]);
    expect(
      last.body.data.map((article: { slug: string }) => article.slug),
    ).toEqual([slugs[0]]);
    expect(last.body.meta.has_next_page).toBe(false);
    expect(past.body.data).toEqual([]);
    expect(past.body.meta).toMatchObject({ total: 5, page: 9 });
  });

  it('keeps the documented article shape and deferred flags', async () => {
    const author = await e2e.fixtures.user({ username: 'shape_author' });
    await seedArticles(e2e, author.id, ['shape']);

    const response = await e2e.request
      .get(`/v1/articles?author=${author.username}`)
      .expect(HttpStatus.OK);

    expect(response.body.data[0]).toMatchObject({
      slug: 'shape',
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

  it('answers an unmatched filter with an empty page', async () => {
    const response = await e2e.request
      .get('/v1/articles?author=absent')
      .expect(HttpStatus.OK);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta).toMatchObject({ total: 0, last_page: 0 });
  });

  it('rejects pagination outside its bounds', async () => {
    await e2e.request
      .get('/v1/articles?limit=101')
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await e2e.request
      .get('/v1/articles?page=0')
      .expect(HttpStatus.UNPROCESSABLE_ENTITY);
    await e2e.request.get('/v1/articles?limit=100').expect(HttpStatus.OK);
  });
});

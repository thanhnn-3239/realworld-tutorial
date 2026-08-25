import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleRecord } from './articles.repository';

describe('ArticleResponseMapper', () => {
  it('maps the stable Issue #5 response contract', () => {
    const timestamp = new Date('2026-08-23T00:00:00.000Z');
    const article = {
      id: 1,
      slug: 'hello',
      title: 'Hello',
      description: 'Description',
      body: 'Body',
      createdAt: timestamp,
      updatedAt: timestamp,
      authorId: 7,
      tagList: [{ name: 'nestjs' }, { name: 'prisma' }],
      author: { username: 'jake', bio: null, image: null },
      _count: { favoritedBy: 2 },
    } satisfies ArticleRecord;

    expect(new ArticleResponseMapper().toResponse(article)).toEqual({
      slug: 'hello',
      title: 'Hello',
      description: 'Description',
      body: 'Body',
      tagList: ['nestjs', 'prisma'],
      createdAt: timestamp,
      updatedAt: timestamp,
      favorited: false,
      favoritesCount: 2,
      author: {
        username: 'jake',
        bio: null,
        image: null,
        following: false,
      },
    });
  });

  it('maps a list preserving order and per-item shape', () => {
    const mapper = new ArticleResponseMapper();
    const timestamp = new Date('2026-08-24T00:00:00.000Z');
    const record = {
      id: 1,
      slug: 'first',
      title: 'First',
      description: 'Description',
      body: 'Body',
      createdAt: timestamp,
      updatedAt: timestamp,
      authorId: 7,
      tagList: [{ name: 'nestjs' }],
      author: { username: 'jake', bio: null, image: null },
      _count: { favoritedBy: 2 },
    } satisfies ArticleRecord;

    const result = mapper.toResponseList([
      record,
      { ...record, slug: 'second' },
    ]);

    expect(result.map((article) => article.slug)).toEqual(['first', 'second']);
    expect(result[0]).toEqual(mapper.toResponse(record));
  });

  it('maps an empty list to an empty list', () => {
    expect(new ArticleResponseMapper().toResponseList([])).toEqual([]);
  });
});

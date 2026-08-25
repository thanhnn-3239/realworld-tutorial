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
});

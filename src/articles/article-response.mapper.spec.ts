import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleRecord } from './articles.repository';

const timestamp = new Date('2026-08-23T00:00:00.000Z');

// Base fixture: the viewer does not follow the author. The repository always
// selects followedBy, so anonymous reads arrive as an empty array, not as absent.
const baseArticle = {
  id: 1,
  slug: 'hello',
  title: 'Hello',
  description: 'Description',
  body: 'Body',
  createdAt: timestamp,
  updatedAt: timestamp,
  authorId: 7,
  tagList: [{ name: 'nestjs' }, { name: 'prisma' }],
  author: { username: 'jake', bio: null, image: null, followedBy: [] },
  _count: { favoritedBy: 2 },
} satisfies ArticleRecord;

describe('ArticleResponseMapper', () => {
  const mapper = new ArticleResponseMapper();

  it('returns following: false when author.followedBy is empty', () => {
    expect(mapper.toResponse(baseArticle).author.following).toBe(false);
  });

  it('returns following: true when author.followedBy contains the viewer', () => {
    const article = {
      ...baseArticle,
      author: { ...baseArticle.author, followedBy: [{ id: 1 }] },
    } satisfies ArticleRecord;
    expect(mapper.toResponse(article).author.following).toBe(true);
  });

  it('maps all stable fields correctly', () => {
    expect(mapper.toResponse(baseArticle)).toEqual({
      slug: 'hello',
      title: 'Hello',
      description: 'Description',
      body: 'Body',
      tagList: ['nestjs', 'prisma'],
      createdAt: timestamp,
      updatedAt: timestamp,
      favorited: false,
      favoritesCount: 2,
      author: { username: 'jake', bio: null, image: null, following: false },
    });
  });

  it('maps a list preserving order and per-item shape', () => {
    const result = mapper.toResponseList([
      baseArticle,
      { ...baseArticle, slug: 'second' },
    ]);
    expect(result.map((a) => a.slug)).toEqual(['hello', 'second']);
    expect(result[0]).toEqual(mapper.toResponse(baseArticle));
  });

  it('maps an empty list to an empty list', () => {
    expect(mapper.toResponseList([])).toEqual([]);
  });
});

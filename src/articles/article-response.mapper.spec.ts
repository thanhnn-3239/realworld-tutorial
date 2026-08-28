import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleRecord } from './article-select';

const timestamp = new Date('2026-08-23T00:00:00.000Z');

// Base fixture: the viewer does not follow the author and has not favorited the
// article. The repository always selects both relations, so anonymous reads
// arrive as empty arrays, not as absent.
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
  favoritedBy: [],
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

  it('returns favorited: false when favoritedBy is empty', () => {
    expect(mapper.toResponse(baseArticle).favorited).toBe(false);
  });

  it('returns favorited: true when favoritedBy contains the viewer', () => {
    const article = {
      ...baseArticle,
      favoritedBy: [{ id: 1 }],
    } satisfies ArticleRecord;
    expect(mapper.toResponse(article).favorited).toBe(true);
  });

  it('keeps favoritesCount global, independent of the viewer flag', () => {
    const article = {
      ...baseArticle,
      favoritedBy: [{ id: 1 }],
    } satisfies ArticleRecord;
    const response = mapper.toResponse(article);

    expect(response.favorited).toBe(true);
    expect(response.favoritesCount).toBe(2);
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

import type { ArticlesRepository } from '../src/articles/articles.repository';
import {
  createArticlesRepository,
  createRepositoryArticle,
} from './support/articles-repository-test-helpers';
import { useDatabaseSuite } from './support/database-suite';

const DAY_ONE = new Date('2026-01-01T00:00:00.000Z');
const DAY_TWO = new Date('2026-01-02T00:00:00.000Z');
const DAY_THREE = new Date('2026-01-03T00:00:00.000Z');

describe('ArticlesRepository listing (integration)', () => {
  const database = useDatabaseSuite('articles-repository-listing');
  let repository: ArticlesRepository;

  beforeAll(() => {
    repository = createArticlesRepository(database.prisma);
  });

  it('returns newest first and reports the true total', async () => {
    const author = await database.fixtures.user();
    for (let index = 0; index < 3; index += 1) {
      await createRepositoryArticle(
        database.prisma,
        author.id,
        `page-${index}`,
        new Date(DAY_ONE.getTime() + index * 1000),
      );
    }

    const first = await repository.listPaginated(
      { author: author.username },
      1,
      2,
    );
    const second = await repository.listPaginated(
      { author: author.username },
      2,
      2,
    );

    expect(first.data.map((article) => article.slug)).toEqual([
      'page-2',
      'page-1',
    ]);
    expect(first.meta).toMatchObject({
      total: 3,
      page: 1,
      last_page: 2,
      limit: 2,
      has_next_page: true,
      has_prev_page: false,
    });
    expect(second.data.map((article) => article.slug)).toEqual(['page-0']);
    expect(second.meta).toMatchObject({
      has_next_page: false,
      has_prev_page: true,
    });
  });

  it('filters by tag, author and favoriting user', async () => {
    const author = await database.fixtures.user({ username: 'author' });
    const fan = await database.fixtures.user({ username: 'fan' });
    await createRepositoryArticle(
      database.prisma,
      author.id,
      'tagged',
      DAY_TWO,
      { tags: ['featured'] },
    );
    await createRepositoryArticle(
      database.prisma,
      author.id,
      'favorited',
      DAY_ONE,
      { favoritedByUserId: fan.id },
    );

    await expect(
      repository
        .listPaginated({ tag: 'featured' }, 1, 10)
        .then((result) => result.data.map((article) => article.slug)),
    ).resolves.toEqual(['tagged']);
    await expect(
      repository
        .listPaginated({ favorited: fan.username }, 1, 10)
        .then((result) => result.data.map((article) => article.slug)),
    ).resolves.toEqual(['favorited']);
    await expect(
      repository
        .listPaginated({ author: author.username }, 1, 10)
        .then((result) => result.meta.total),
    ).resolves.toBe(2);
  });

  it('narrows to the intersection when filters combine', async () => {
    const author = await database.fixtures.user({ username: 'author' });
    const other = await database.fixtures.user({ username: 'other' });
    await createRepositoryArticle(
      database.prisma,
      author.id,
      'match',
      DAY_ONE,
      {
        tags: ['shared'],
      },
    );
    await createRepositoryArticle(
      database.prisma,
      other.id,
      'other-author',
      DAY_ONE,
      { tags: ['shared'] },
    );

    const result = await repository.listPaginated(
      { tag: 'shared', author: author.username },
      1,
      10,
    );
    expect(result.data.map((article) => article.slug)).toEqual(['match']);
    expect(result.meta.total).toBe(1);
  });

  it('reports an unmatched filter as an empty page', async () => {
    const result = await repository.listPaginated({ author: 'absent' }, 1, 10);

    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({
      total: 0,
      last_page: 0,
      has_next_page: false,
    });
  });

  it('returns only articles by authors the caller follows', async () => {
    const follower = await database.fixtures.user();
    const followed = await database.fixtures.user();
    const stranger = await database.fixtures.user();
    await database.prisma.user.update({
      where: { id: follower.id },
      data: { following: { connect: { id: followed.id } } },
    });
    await createRepositoryArticle(
      database.prisma,
      followed.id,
      'followed',
      DAY_THREE,
    );
    await createRepositoryArticle(
      database.prisma,
      stranger.id,
      'stranger',
      DAY_TWO,
    );
    await createRepositoryArticle(database.prisma, follower.id, 'own', DAY_ONE);

    const result = await repository.listFeedPaginated(follower.id, 1, 10);
    expect(result.data.map((article) => article.slug)).toEqual(['followed']);
    expect(result.meta.total).toBe(1);
  });
});

import { FavoritesRepository } from '../src/favorites/favorites.repository';
import type { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { useDatabaseSuite } from './support/database-suite';

describe('FavoritesRepository (integration)', () => {
  const database = useDatabaseSuite('favorites-repository');
  let repository: FavoritesRepository;

  beforeAll(() => {
    repository = new FavoritesRepository(
      database.prisma as unknown as PrismaService,
    );
  });

  function createArticle(prisma: PrismaClient, authorId: number, slug: string) {
    return prisma.article.create({
      data: {
        slug,
        title: slug,
        description: 'Description',
        body: 'Body',
        author: { connect: { id: authorId } },
      },
    });
  }

  it('returns the post-mutation count and the viewer flag from connect', async () => {
    const author = await database.fixtures.user();
    const fan = await database.fixtures.user();
    await createArticle(database.prisma, author.id, 'connect');

    const result = await repository.connect('connect', fan.id);

    expect(result._count.favoritedBy).toBe(1);
    expect(result.favoritedBy).toEqual([{ id: fan.id }]);
  });

  it('returns the post-mutation count and an empty flag from disconnect', async () => {
    const author = await database.fixtures.user();
    const fan = await database.fixtures.user();
    await createArticle(database.prisma, author.id, 'disconnect');
    await repository.connect('disconnect', fan.id);

    const result = await repository.disconnect('disconnect', fan.id);

    expect(result._count.favoritedBy).toBe(0);
    expect(result.favoritedBy).toEqual([]);
  });

  it('counts every favoriter globally but scopes the flag to the viewer', async () => {
    const author = await database.fixtures.user();
    const fanA = await database.fixtures.user();
    const fanB = await database.fixtures.user();
    await createArticle(database.prisma, author.id, 'shared');

    await repository.connect('shared', fanA.id);
    const asFanB = await repository.connect('shared', fanB.id);

    expect(asFanB._count.favoritedBy).toBe(2);
    expect(asFanB.favoritedBy).toEqual([{ id: fanB.id }]);
  });

  it('treats disconnect of an absent edge as a no-op rather than an error', async () => {
    const author = await database.fixtures.user();
    const stranger = await database.fixtures.user();
    await createArticle(database.prisma, author.id, 'absent-edge');

    const result = await repository.disconnect('absent-edge', stranger.id);

    expect(result._count.favoritedBy).toBe(0);
    expect(result.favoritedBy).toEqual([]);
  });

  it('permits an author to favorite their own article', async () => {
    const author = await database.fixtures.user();
    await createArticle(database.prisma, author.id, 'self-favorite');

    const result = await repository.connect('self-favorite', author.id);

    expect(result._count.favoritedBy).toBe(1);
    expect(result.favoritedBy).toEqual([{ id: author.id }]);
  });
});

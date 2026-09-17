import type { ArticlesRepository } from '../src/articles/articles.repository';
import { useDatabaseSuite } from './support/database-suite';
import { createArticlesRepository } from './support/articles-repository-test-helpers';

describe('ArticlesRepository mutations (integration)', () => {
  const database = useDatabaseSuite('articles-repository-mutations');
  let repository: ArticlesRepository;

  beforeAll(() => {
    repository = createArticlesRepository(database.prisma);
  });

  it('creates an article and tags atomically', async () => {
    const author = await database.fixtures.user();
    const article = await repository.create({
      slug: 'repository-article',
      title: 'Repository article',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: ['nestjs', 'prisma'],
    });

    expect(article.tagList.map((tag) => tag.name)).toEqual([
      'nestjs',
      'prisma',
    ]);
    expect(article._count.favoritedBy).toBe(0);
  });

  it('replaces tag links without deleting orphan tags', async () => {
    const author = await database.fixtures.user();
    const article = await repository.create({
      slug: 'replace-tags',
      title: 'Replace tags',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: ['orphan-source'],
    });
    const updated = await repository.update(article.id, {
      tags: ['replacement'],
    });

    expect(updated.tagList.map((tag) => tag.name)).toEqual(['replacement']);
    await expect(
      database.prisma.tag.findUnique({ where: { name: 'orphan-source' } }),
    ).resolves.not.toBeNull();
  });

  it('updates updatedAt through Prisma Client', async () => {
    const author = await database.fixtures.user();
    const article = await repository.create({
      slug: 'updated-at',
      title: 'Original',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: [],
    });
    const before = await repository.findBySlug(article.slug);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const after = await repository.update(before!.id, { title: 'Changed' });

    expect(after.updatedAt.getTime()).toBeGreaterThan(
      before!.updatedAt.getTime(),
    );
  });

  it('rolls back tag creation when article creation fails', async () => {
    await expect(
      repository.create({
        slug: 'must-rollback',
        title: 'Must rollback',
        description: 'Description',
        body: 'Body',
        authorId: -1,
        tags: ['rollback-tag'],
      }),
    ).rejects.toBeDefined();

    await expect(
      database.prisma.article.findUnique({ where: { slug: 'must-rollback' } }),
    ).resolves.toBeNull();
    await expect(
      database.prisma.tag.findUnique({ where: { name: 'rollback-tag' } }),
    ).resolves.toBeNull();
  });

  it('deletes join records but retains global tags', async () => {
    const author = await database.fixtures.user();
    const article = await repository.create({
      slug: 'delete-me',
      title: 'Delete me',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: ['retained-tag'],
    });

    await repository.delete(article.id);

    await expect(
      database.prisma.article.findUnique({ where: { id: article.id } }),
    ).resolves.toBeNull();
    await expect(
      database.prisma.tag.findUnique({ where: { name: 'retained-tag' } }),
    ).resolves.not.toBeNull();
  });
});

import { ArticlesRepository } from '../src/articles/articles.repository';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestDatabase, TestDatabase } from './support/test-database';

const HOOK_TIMEOUT_MS = 60_000;

describe('ArticlesRepository (integration)', () => {
  let db: TestDatabase | undefined;
  let prisma: PrismaClient;
  let repository: ArticlesRepository;
  let fixtureNumber = 0;

  beforeAll(async () => {
    db = await createTestDatabase('articles_repo');
    prisma = await db.client();
    repository = new ArticlesRepository(prisma as unknown as PrismaService);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await db?.drop();
  }, HOOK_TIMEOUT_MS);

  async function createAuthor() {
    fixtureNumber += 1;
    return prisma.user.create({
      data: {
        email: `article-repository-${process.pid}-${fixtureNumber}@example.com`,
        username: `article_repository_${process.pid}_${fixtureNumber}`,
        password: 'hashed-for-test',
      },
    });
  }

  it('creates an article and tags atomically', async () => {
    const author = await createAuthor();
    const article = await repository.create({
      slug: `repository-article-${process.pid}`,
      title: 'Repository article',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: [`nestjs-${process.pid}`, `prisma-${process.pid}`],
    });

    expect(article.tagList.map((tag) => tag.name)).toEqual([
      `nestjs-${process.pid}`,
      `prisma-${process.pid}`,
    ]);
    expect(article._count.favoritedBy).toBe(0);
  });

  it('replaces all tag links without deleting orphan tags', async () => {
    const author = await createAuthor();
    const originalTag = `orphan-source-${process.pid}`;
    const replacementTag = `orphan-kept-${process.pid}`;
    const article = await repository.create({
      slug: `replace-tags-${process.pid}`,
      title: 'Replace tags',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: [originalTag],
    });
    const updated = await repository.update(article.id, {
      tags: [replacementTag],
    });

    expect(updated.tagList.map((tag) => tag.name)).toEqual([replacementTag]);
    await expect(
      prisma.tag.findUnique({ where: { name: originalTag } }),
    ).resolves.not.toBeNull();
  });

  it('updates updatedAt through Prisma Client', async () => {
    const author = await createAuthor();
    const article = await repository.create({
      slug: `updated-at-${process.pid}`,
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
    const rollbackTag = `rollback-tag-${process.pid}`;
    await expect(
      repository.create({
        slug: `must-rollback-${process.pid}`,
        title: 'Must rollback',
        description: 'Description',
        body: 'Body',
        authorId: -1,
        tags: [rollbackTag],
      }),
    ).rejects.toBeDefined();

    await expect(
      prisma.article.findUnique({
        where: { slug: `must-rollback-${process.pid}` },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.tag.findUnique({ where: { name: rollbackTag } }),
    ).resolves.toBeNull();
  });

  it('deletes join records but retains global tags', async () => {
    const author = await createAuthor();
    const retainedTag = `delete-kept-${process.pid}`;
    const article = await repository.create({
      slug: `delete-me-${process.pid}`,
      title: 'Delete me',
      description: 'Description',
      body: 'Body',
      authorId: author.id,
      tags: [retainedTag],
    });

    await repository.delete(article.id);

    await expect(
      prisma.article.findUnique({ where: { id: article.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.tag.findUnique({ where: { name: retainedTag } }),
    ).resolves.not.toBeNull();
  });
});

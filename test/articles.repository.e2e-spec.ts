import { ArticlesRepository } from '../src/articles/articles.repository';
import { PrismaClient } from '../src/generated/prisma/client';
import { paginationExtension } from '../src/prisma/prisma.extension';
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
    Object.assign(prisma, { extended: prisma.$extends(paginationExtension) });
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

  async function createArticleFor(
    authorId: number,
    slug: string,
    createdAt: Date,
    extra: { tags?: string[]; favoritedByUserId?: number } = {},
  ) {
    return prisma.article.create({
      data: {
        slug,
        title: slug,
        description: 'Description',
        body: 'Body',
        createdAt,
        author: { connect: { id: authorId } },
        ...(extra.tags === undefined
          ? {}
          : {
              tagList: {
                connectOrCreate: extra.tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }),
        ...(extra.favoritedByUserId === undefined
          ? {}
          : { favoritedBy: { connect: { id: extra.favoritedByUserId } } }),
      },
    });
  }

  it('returns newest first and reports the true total across pages', async () => {
    const author = await createAuthor();
    const nonce = `page-${process.pid}-${author.id}`;
    for (let index = 0; index < 3; index += 1) {
      await createArticleFor(
        author.id,
        `${nonce}-${index}`,
        new Date(Date.parse('2026-01-01T00:00:00.000Z') + index * 1000),
      );
    }

    const first = await repository.listPaginated({ author: author.username }, 1, 2);
    const second = await repository.listPaginated({ author: author.username }, 2, 2);

    expect(first.data.map((article) => article.slug)).toEqual([
      `${nonce}-2`,
      `${nonce}-1`,
    ]);
    expect(first.meta).toMatchObject({
      total: 3,
      page: 1,
      last_page: 2,
      limit: 2,
      has_next_page: true,
      has_prev_page: false,
    });
    expect(second.data.map((article) => article.slug)).toEqual([`${nonce}-0`]);
    expect(second.meta).toMatchObject({ has_next_page: false, has_prev_page: true });
  });

  it('filters by tag, by author and by the user who favorited', async () => {
    const author = await createAuthor();
    const fan = await createAuthor();
    const nonce = `filter-${process.pid}-${author.id}`;
    const tag = `tag-${nonce}`;
    await createArticleFor(author.id, `${nonce}-tagged`, new Date('2026-01-02T00:00:00.000Z'), {
      tags: [tag],
    });
    await createArticleFor(author.id, `${nonce}-favorited`, new Date('2026-01-01T00:00:00.000Z'), {
      favoritedByUserId: fan.id,
    });

    await expect(
      repository.listPaginated({ tag }, 1, 10).then((result) => result.data.map((a) => a.slug)),
    ).resolves.toEqual([`${nonce}-tagged`]);
    await expect(
      repository
        .listPaginated({ favorited: fan.username }, 1, 10)
        .then((result) => result.data.map((a) => a.slug)),
    ).resolves.toEqual([`${nonce}-favorited`]);
    await expect(
      repository
        .listPaginated({ author: author.username }, 1, 10)
        .then((result) => result.meta.total),
    ).resolves.toBe(2);
  });

  it('narrows to the intersection when filters combine', async () => {
    const author = await createAuthor();
    const other = await createAuthor();
    const nonce = `combo-${process.pid}-${author.id}`;
    const tag = `tag-${nonce}`;
    await createArticleFor(author.id, `${nonce}-match`, new Date('2026-01-01T00:00:00.000Z'), {
      tags: [tag],
    });
    await createArticleFor(other.id, `${nonce}-other-author`, new Date('2026-01-01T00:00:00.000Z'), {
      tags: [tag],
    });

    const result = await repository.listPaginated(
      { tag, author: author.username },
      1,
      10,
    );

    expect(result.data.map((article) => article.slug)).toEqual([`${nonce}-match`]);
    expect(result.meta.total).toBe(1);
  });

  it('reports an unmatched filter as an empty page rather than an error', async () => {
    const result = await repository.listPaginated(
      { author: `absent_${process.pid}` },
      1,
      10,
    );

    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ total: 0, last_page: 0, has_next_page: false });
  });

  // `following` and `followedBy` are the two ends of one implicit self-relation
  // and are easy to invert while reading. Seeding from the follower side and
  // asserting the result pins the direction here rather than in review.
  it('returns only articles by authors the caller follows', async () => {
    const follower = await createAuthor();
    const followed = await createAuthor();
    const stranger = await createAuthor();
    const nonce = `feed-${process.pid}-${follower.id}`;
    await prisma.user.update({
      where: { id: follower.id },
      data: { following: { connect: { id: followed.id } } },
    });
    await createArticleFor(followed.id, `${nonce}-followed`, new Date('2026-01-03T00:00:00.000Z'));
    await createArticleFor(stranger.id, `${nonce}-stranger`, new Date('2026-01-02T00:00:00.000Z'));
    await createArticleFor(follower.id, `${nonce}-own`, new Date('2026-01-01T00:00:00.000Z'));

    const result = await repository.listFeedPaginated(follower.id, 1, 10);

    expect(result.data.map((article) => article.slug)).toEqual([`${nonce}-followed`]);
    expect(result.meta.total).toBe(1);
  });
});

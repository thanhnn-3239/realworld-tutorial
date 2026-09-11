import type { E2eContext } from './e2e-suite';

const SEED_EPOCH = Date.parse('2026-01-01T00:00:00.000Z');

interface SeedArticleOptions {
  readonly tags?: readonly string[];
  readonly favoritedByUserId?: number;
}

export async function seedArticles(
  e2e: E2eContext,
  authorId: number,
  slugs: readonly string[],
  options: SeedArticleOptions = {},
): Promise<void> {
  for (const [index, slug] of slugs.entries()) {
    await e2e.prisma.article.create({
      data: {
        slug,
        title: slug,
        description: 'Description',
        body: 'Body',
        createdAt: new Date(SEED_EPOCH + index * 1000),
        author: { connect: { id: authorId } },
        ...(options.tags === undefined
          ? {}
          : {
              tagList: {
                connectOrCreate: options.tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }),
        ...(options.favoritedByUserId === undefined
          ? {}
          : {
              favoritedBy: {
                connect: { id: options.favoritedByUserId },
              },
            }),
      },
    });
  }
}

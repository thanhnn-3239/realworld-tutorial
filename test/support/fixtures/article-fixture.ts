import type { Prisma } from '../../../src/generated/prisma/client';

export interface ArticleFixtureInput {
  readonly authorId: number;
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string;
  readonly body?: string;
  readonly tags?: readonly string[];
}

export type TestArticle = Prisma.ArticleGetPayload<{
  include: { tagList: true };
}>;

interface ArticleFixturePrisma {
  readonly article: {
    create(args: {
      data: Prisma.ArticleCreateInput;
      include: { tagList: true };
    }): Promise<TestArticle>;
  };
}

export function createArticleFixture(
  prisma: ArticleFixturePrisma,
  sequence: number,
  input: ArticleFixtureInput,
): Promise<TestArticle> {
  const tags = input.tags ?? [];

  return prisma.article.create({
    data: {
      slug: input.slug ?? `article-${sequence}`,
      title: input.title ?? `Article ${sequence}`,
      description: input.description ?? 'Fixture description',
      body: input.body ?? 'Fixture body',
      author: { connect: { id: input.authorId } },
      tagList: {
        connectOrCreate: tags.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
    include: { tagList: true },
  });
}

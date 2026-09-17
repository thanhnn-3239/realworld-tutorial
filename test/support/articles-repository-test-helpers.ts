import { ArticlesRepository } from '../../src/articles/articles.repository';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { paginationExtension } from '../../src/prisma/prisma.extension';
import type { PrismaService } from '../../src/prisma/prisma.service';

export function createArticlesRepository(prisma: PrismaClient) {
  Object.assign(prisma, { extended: prisma.$extends(paginationExtension) });
  return new ArticlesRepository(prisma as unknown as PrismaService);
}

interface ArticleSeedOptions {
  readonly tags?: readonly string[];
  readonly favoritedByUserId?: number;
}

export function createRepositoryArticle(
  prisma: PrismaClient,
  authorId: number,
  slug: string,
  createdAt: Date,
  options: ArticleSeedOptions = {},
) {
  return prisma.article.create({
    data: {
      slug,
      title: slug,
      description: 'Description',
      body: 'Body',
      createdAt,
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
            favoritedBy: { connect: { id: options.favoritedByUserId } },
          }),
    },
  });
}

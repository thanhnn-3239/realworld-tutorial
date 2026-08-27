import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Paginated } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';

const articleResponseSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  tagList: {
    select: { name: true },
    orderBy: { name: 'asc' as const },
  },
  author: {
    select: { username: true, bio: true, image: true },
  },
  _count: {
    select: { favoritedBy: true },
  },
} satisfies Prisma.ArticleSelect;

export type ArticleRecord = Prisma.ArticleGetPayload<{
  select: typeof articleResponseSelect;
}>;

// Shared so the list and feed queries cannot drift apart in shape or order.
const articleListArgs = {
  select: articleResponseSelect,
  orderBy: { createdAt: 'desc' as const },
};

/**
 * Absent filters are omitted rather than set to `undefined`, so the emitted SQL
 * carries only the conditions the caller actually asked for.
 */
function buildListWhere(filter: ArticleListFilter): Prisma.ArticleWhereInput {
  return {
    ...(filter.tag === undefined
      ? {}
      : { tagList: { some: { name: filter.tag } } }),
    ...(filter.author === undefined
      ? {}
      : { author: { username: filter.author } }),
    ...(filter.favorited === undefined
      ? {}
      : { favoritedBy: { some: { username: filter.favorited } } }),
  };
}

export interface ArticleListFilter {
  tag?: string;
  author?: string;
  favorited?: string;
}

export interface ArticleIdentity {
  id: number;
  slug: string;
  title: string;
  authorId: number;
}

export interface CreateArticleData {
  slug: string;
  title: string;
  description: string;
  body: string;
  authorId: number;
  tags: string[];
}

export interface UpdateArticleData {
  slug?: string;
  title?: string;
  description?: string;
  body?: string;
  tags?: string[];
}

@Injectable()
export class ArticlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string) {
    return this.prisma.article.findUnique({
      where: { slug },
      select: articleResponseSelect,
    });
  }

  findIdentityBySlug(slug: string): Promise<ArticleIdentity | null> {
    return this.prisma.article.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true, authorId: true },
    });
  }

  async findSlugsByBase(
    base: string,
    excludeArticleId?: number,
  ): Promise<string[]> {
    const rows = await this.prisma.article.findMany({
      where: {
        OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }],
        ...(excludeArticleId === undefined
          ? {}
          : { NOT: { id: excludeArticleId } }),
      },
      select: { slug: true },
    });
    return rows.map(({ slug }) => slug);
  }

  listPaginated(
    filter: ArticleListFilter,
    page: number,
    limit: number,
  ): Promise<Paginated<ArticleRecord[]>> {
    return this.prisma.extended.article.paginate({
      ...articleListArgs,
      where: buildListWhere(filter),
      page,
      limit,
    });
  }

  listFeedPaginated(
    userId: number,
    page: number,
    limit: number,
  ): Promise<Paginated<ArticleRecord[]>> {
    return this.prisma.extended.article.paginate({
      ...articleListArgs,
      where: { author: { followedBy: { some: { id: userId } } } },
      page,
      limit,
    });
  }

  create(data: CreateArticleData) {
    return this.prisma.article.create({
      data: {
        slug: data.slug,
        title: data.title,
        description: data.description,
        body: data.body,
        author: { connect: { id: data.authorId } },
        tagList: {
          connectOrCreate: data.tags.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      select: articleResponseSelect,
    });
  }

  update(id: number, data: UpdateArticleData) {
    const { tags, ...articleFields } = data;
    return this.prisma.article.update({
      where: { id },
      data: {
        ...articleFields,
        ...(tags === undefined
          ? {}
          : {
              tagList: {
                set: [],
                connectOrCreate: tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }),
      },
      select: articleResponseSelect,
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.article.delete({ where: { id }, select: { id: true } });
  }
}

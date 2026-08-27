import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Paginated } from '../prisma/prisma.extension';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Builds the article select object.
 * The author's followedBy relation is filtered down to the viewer, so the
 * mapper can derive `following` from its length without a second query.
 */
function buildArticleSelect(viewerId?: number) {
  return {
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
      select: {
        username: true,
        bio: true,
        image: true,
        // Select shape stays constant so Prisma keeps the narrow payload
        // type; an empty `in` matches nothing, so anonymous reads yield [].
        followedBy: {
          where: viewerId === undefined ? { id: { in: [] } } : { id: viewerId },
          select: { id: true },
        },
      },
    },
    _count: {
      select: { favoritedBy: true },
    },
  } satisfies Prisma.ArticleSelect;
}

const articleIdentitySelect = {
  id: true,
  slug: true,
  title: true,
  authorId: true,
} satisfies Prisma.ArticleSelect;

const articleSlugSelect = { slug: true } satisfies Prisma.ArticleSelect;

export type ArticleRecord = Prisma.ArticleGetPayload<{
  select: ReturnType<typeof buildArticleSelect>;
}>;

const articleListOrderBy = { createdAt: 'desc' as const };

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

  findBySlug(slug: string, viewerId?: number) {
    return this.prisma.article.findUnique({
      where: { slug },
      select: buildArticleSelect(viewerId),
    });
  }

  findIdentityBySlug(slug: string): Promise<ArticleIdentity | null> {
    return this.prisma.article.findUnique({
      where: { slug },
      select: articleIdentitySelect,
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
      select: articleSlugSelect,
    });
    return rows.map(({ slug }) => slug);
  }

  listPaginated(
    filter: ArticleListFilter,
    page: number,
    limit: number,
    viewerId?: number,
  ): Promise<Paginated<ArticleRecord[]>> {
    return this.prisma.extended.article.paginate({
      select: buildArticleSelect(viewerId),
      orderBy: articleListOrderBy,
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
      select: buildArticleSelect(userId),
      orderBy: articleListOrderBy,
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
      select: buildArticleSelect(),
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
      select: buildArticleSelect(),
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.article.delete({ where: { id }, select: { id: true } });
  }
}

import { Prisma } from '../generated/prisma/client';

/**
 * Builds the article select object.
 * The author's followedBy relation is filtered down to the viewer, so the
 * mapper can derive `following` from its length without a second query.
 */
export function buildArticleSelect(viewerId?: number) {
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
    // Same constant-shape trick as author.followedBy: this filtered relation
    // both carries the per-viewer flag and answers "already favorited?", so
    // the favorites service needs no separate existence query.
    favoritedBy: {
      where: viewerId === undefined ? { id: { in: [] } } : { id: viewerId },
      select: { id: true },
    },
    _count: {
      select: { favoritedBy: true },
    },
  } satisfies Prisma.ArticleSelect;
}

export type ArticleRecord = Prisma.ArticleGetPayload<{
  select: ReturnType<typeof buildArticleSelect>;
}>;

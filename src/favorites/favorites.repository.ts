import { Injectable } from '@nestjs/common';
import { ArticleRecord, buildArticleSelect } from '../articles/article-select';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A nested write carrying a select is transactional, and the select is
   * evaluated after the mutation — so `_count.favoritedBy` returns the new
   * total without an explicit transaction or manual count arithmetic.
   */
  connect(slug: string, viewerId: number): Promise<ArticleRecord> {
    return this.prisma.article.update({
      where: { slug },
      data: { favoritedBy: { connect: { id: viewerId } } },
      select: buildArticleSelect(viewerId),
    });
  }

  /** Mirror of connect. Disconnecting an absent edge is a no-op in Prisma. */
  disconnect(slug: string, viewerId: number): Promise<ArticleRecord> {
    return this.prisma.article.update({
      where: { slug },
      data: { favoritedBy: { disconnect: { id: viewerId } } },
      select: buildArticleSelect(viewerId),
    });
  }
}

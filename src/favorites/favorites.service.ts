import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticleResponseMapper } from '../articles/article-response.mapper';
import { ArticlesRepository } from '../articles/articles.repository';
import { ArticleRecord } from '../articles/article-select';
import { ArticleResponse } from '../articles/interfaces/article-response.interface';
import { Prisma } from '../generated/prisma/client';
import { ArticleEventProducer } from '../kafka/producers/article-event.producer';
import { UsersRepository } from '../users/users.repository';
import { FavoritesRepository } from './favorites.repository';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly favoritesRepository: FavoritesRepository,
    private readonly responseMapper: ArticleResponseMapper,
    private readonly i18n: I18nService,
    private readonly eventProducer: ArticleEventProducer,
    private readonly usersRepository: UsersRepository,
  ) {}

  async favorite(userId: number, slug: string): Promise<ArticleResponse> {
    const article = await this.requireArticle(userId, slug);
    if (article.favoritedBy.length > 0) {
      return this.responseMapper.toResponse(article);
    }

    const [updated, actor] = await Promise.all([
      this.write(userId, slug, () =>
        this.favoritesRepository.connect(slug, userId),
      ),
      this.usersRepository.findById(userId),
    ]);

    this.eventProducer.emitArticleFavorited({
      articleId: updated.id,
      slug: updated.slug,
      title: updated.title,
      authorId: updated.authorId,
      favoritedByUserId: userId,
      favoritedByUsername: actor?.username ?? `user-${userId}`,
      occurredAt: new Date().toISOString(),
    });

    return this.responseMapper.toResponse(updated);
  }

  async unfavorite(userId: number, slug: string): Promise<ArticleResponse> {
    const article = await this.requireArticle(userId, slug);
    if (article.favoritedBy.length === 0) {
      return this.responseMapper.toResponse(article);
    }

    return this.responseMapper.toResponse(
      await this.write(userId, slug, () =>
        this.favoritesRepository.disconnect(slug, userId),
      ),
    );
  }

  /**
   * The viewer-filtered favoritedBy relation rides along on this select, so
   * this one read both gates the 404 and answers "already favorited?".
   */
  private async requireArticle(
    userId: number,
    slug: string,
  ): Promise<ArticleRecord> {
    const article = await this.articlesRepository.findBySlug(slug, userId);
    if (!article) {
      throw new NotFoundException(this.i18n.t('common.error.articleNotFound'));
    }
    return article;
  }

  /**
   * A concurrent request can insert the same edge between the read above and
   * this write, colliding with the join table's (A, B) primary key. Idempotent
   * semantics already promise the caller success, so re-read and return that.
   */
  private async write(
    userId: number,
    slug: string,
    mutate: () => Promise<ArticleRecord>,
  ): Promise<ArticleRecord> {
    try {
      return await mutate();
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      return this.requireArticle(userId, slug);
    }
  }
}

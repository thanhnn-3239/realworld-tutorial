import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticlesRepository } from '../articles/articles.repository';
import { CommentResponseMapper } from './comment-response.mapper';
import { CommentsRepository } from './comments.repository';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponse } from './interfaces/comment-response.interface';

@Injectable()
export class CommentsService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly commentsRepository: CommentsRepository,
    private readonly responseMapper: CommentResponseMapper,
    private readonly i18n: I18nService,
  ) {}

  async list(slug: string): Promise<CommentResponse[]> {
    const article = await this.requireArticle(slug);
    const comments = await this.commentsRepository.listByArticleId(article.id);

    return this.responseMapper.toResponseList(comments);
  }

  async create(
    userId: number,
    slug: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    const article = await this.requireArticle(slug);
    const comment = await this.commentsRepository.create(
      article.id,
      userId,
      dto.body,
    );

    return this.responseMapper.toResponse(comment);
  }

  async remove(userId: number, slug: string, commentId: number): Promise<null> {
    const article = await this.requireArticle(slug);
    const comment = await this.commentsRepository.findIdentity(
      commentId,
      article.id,
    );
    if (!comment) {
      throw new NotFoundException(this.i18n.t('common.error.commentNotFound'));
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        this.i18n.t('common.error.commentForbidden'),
      );
    }

    await this.commentsRepository.delete(comment.id);
    return null;
  }

  private async requireArticle(slug: string) {
    const article = await this.articlesRepository.findIdentityBySlug(slug);
    if (!article) {
      throw new NotFoundException(this.i18n.t('common.error.articleNotFound'));
    }

    return article;
  }
}

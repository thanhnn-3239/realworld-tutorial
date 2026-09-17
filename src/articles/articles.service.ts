import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PaginationDto } from '../common/dto/api-response.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  Paginated,
} from '../prisma/prisma.extension';
import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleSlugService } from './article-slug.service';
import { ArticleEventProducer } from '../kafka/article-event.producer';
import {
  buildArticleFilter,
  hasEffectiveUpdate,
  normalizeTags,
} from './articles.helper';
import { ArticlesRepository, UpdateArticleData } from './articles.repository';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleResponse } from './interfaces/article-response.interface';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly slugService: ArticleSlugService,
    private readonly responseMapper: ArticleResponseMapper,
    private readonly i18n: I18nService,
    private readonly eventProducer: ArticleEventProducer,
  ) {}

  async create(
    userId: number,
    dto: CreateArticleDto,
  ): Promise<ArticleResponse> {
    const title = dto.title.trim();
    const description = dto.description.trim();
    const tags = normalizeTags(dto.tagList ?? []);
    const article = await this.slugService.execute(title, (slug) =>
      this.articlesRepository.create({
        slug,
        title,
        description,
        body: dto.body,
        authorId: userId,
        tags,
      }),
    );

    this.eventProducer.emitArticleCreated({
      articleId: article.id,
      slug: article.slug,
      title: article.title,
      authorId: userId,
      authorUsername: article.author.username,
      occurredAt: new Date().toISOString(),
    });

    return this.responseMapper.toResponse(article);
  }

  async list(
    query: ListArticlesQueryDto,
    viewerId?: number,
  ): Promise<Paginated<ArticleResponse[]>> {
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = query;
    const { data, meta } = await this.articlesRepository.listPaginated(
      buildArticleFilter(query),
      page,
      limit,
      viewerId,
    );

    return { data: this.responseMapper.toResponseList(data), meta };
  }

  async feed(
    userId: number,
    query: PaginationDto,
  ): Promise<Paginated<ArticleResponse[]>> {
    const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = query;
    const { data, meta } = await this.articlesRepository.listFeedPaginated(
      userId,
      page,
      limit,
    );

    return { data: this.responseMapper.toResponseList(data), meta };
  }

  async getBySlug(slug: string, viewerId?: number): Promise<ArticleResponse> {
    const article = await this.articlesRepository.findBySlug(slug, viewerId);
    if (!article) {
      throw new NotFoundException(this.i18n.t('common.error.articleNotFound'));
    }

    return this.responseMapper.toResponse(article);
  }

  async update(
    userId: number,
    slug: string,
    dto: UpdateArticleDto,
  ): Promise<ArticleResponse> {
    const identity = await this.requireOwnedArticle(userId, slug);
    if (!hasEffectiveUpdate(dto)) {
      throw new UnprocessableEntityException(
        this.i18n.t('common.error.emptyArticleUpdate'),
      );
    }

    const title = dto.title?.trim();
    const data: UpdateArticleData = {
      ...(title === undefined ? {} : { title }),
      ...(dto.description === undefined
        ? {}
        : { description: dto.description.trim() }),
      ...(dto.body === undefined ? {} : { body: dto.body }),
      ...(dto.tagList === undefined
        ? {}
        : { tags: normalizeTags(dto.tagList) }),
    };

    const article =
      title !== undefined && title !== identity.title
        ? await this.slugService.execute(
            title,
            (newSlug) =>
              this.articlesRepository.update(
                identity.id,
                { ...data, slug: newSlug },
                userId,
              ),
            identity.id,
          )
        : await this.articlesRepository.update(identity.id, data, userId);

    return this.responseMapper.toResponse(article);
  }

  async remove(userId: number, slug: string): Promise<null> {
    const identity = await this.requireOwnedArticle(userId, slug);
    await this.articlesRepository.delete(identity.id);

    return null;
  }

  private async requireOwnedArticle(userId: number, slug: string) {
    const article = await this.articlesRepository.findIdentityBySlug(slug);
    if (!article) {
      throw new NotFoundException(this.i18n.t('common.error.articleNotFound'));
    }
    if (article.authorId !== userId) {
      throw new ForbiddenException(
        this.i18n.t('common.error.articleForbidden'),
      );
    }

    return article;
  }
}

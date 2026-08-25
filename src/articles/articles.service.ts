import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleSlugService } from './article-slug.service';
import { ArticlesRepository, UpdateArticleData } from './articles.repository';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleResponse } from './interfaces/article-response.interface';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly slugService: ArticleSlugService,
    private readonly responseMapper: ArticleResponseMapper,
    private readonly i18n: I18nService,
  ) {}

  async create(
    userId: number,
    dto: CreateArticleDto,
  ): Promise<ArticleResponse> {
    const title = dto.title.trim();
    const description = dto.description.trim();
    const tags = this.normalizeTags(dto.tagList ?? []);
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

    return this.responseMapper.toResponse(article);
  }

  async getBySlug(slug: string): Promise<ArticleResponse> {
    const article = await this.articlesRepository.findBySlug(slug);
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
    if (!this.hasEffectiveUpdate(dto)) {
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
        : { tags: this.normalizeTags(dto.tagList) }),
    };

    const article =
      title !== undefined && title !== identity.title
        ? await this.slugService.execute(
            title,
            (newSlug) =>
              this.articlesRepository.update(identity.id, {
                ...data,
                slug: newSlug,
              }),
            identity.id,
          )
        : await this.articlesRepository.update(identity.id, data);

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

  private hasEffectiveUpdate(dto: UpdateArticleDto): boolean {
    return [dto.title, dto.description, dto.body, dto.tagList].some(
      (value) => value !== undefined,
    );
  }

  private normalizeTags(tags: string[]): string[] {
    return [
      ...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
    ];
  }
}

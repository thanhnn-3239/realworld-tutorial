import { ConflictException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '../generated/prisma/client';
import {
  ARTICLE_SLUG_FALLBACK,
  SLUG_GENERATION_MAX_RETRIES,
} from './articles.constants';
import { ArticlesRepository } from './articles.repository';

@Injectable()
export class ArticleSlugService {
  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly i18n: I18nService,
  ) {}

  async execute<T>(
    title: string,
    write: (slug: string) => Promise<T>,
    excludeArticleId?: number,
  ): Promise<T> {
    for (let attempt = 0; attempt < SLUG_GENERATION_MAX_RETRIES; attempt += 1) {
      const slug = await this.createCandidate(title, excludeArticleId);

      try {
        return await write(slug);
      } catch (error) {
        if (!this.isSlugConflict(error)) {
          // Preserve the original rejection value instead of wrapping it.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          return Promise.reject(error);
        }
      }
    }

    throw new ConflictException(
      this.i18n.t('common.error.articleSlugConflict'),
    );
  }

  async createCandidate(
    title: string,
    excludeArticleId?: number,
  ): Promise<string> {
    const base = this.toBaseSlug(title);
    const used = new Set(
      await this.articlesRepository.findSlugsByBase(base, excludeArticleId),
    );

    if (!used.has(base)) {
      return base;
    }

    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) {
      suffix += 1;
    }

    return `${base}-${suffix}`;
  }

  toBaseSlug(title: string): string {
    const slug = title
      .trim()
      .toLowerCase()
      .replace(/đ/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || ARTICLE_SLUG_FALLBACK;
  }

  private isSlugConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.includes('slug')
      : String(target).includes('slug');
  }
}

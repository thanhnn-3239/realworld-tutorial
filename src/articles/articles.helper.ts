import { ArticleListFilter } from './articles.repository';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

export function hasEffectiveUpdate(dto: UpdateArticleDto): boolean {
  return [dto.title, dto.description, dto.body, dto.tagList].some(
    (value) => value !== undefined,
  );
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => normalizeTag(tag)).filter(Boolean))];
}

/**
 * A tag that normalizes to nothing is dropped rather than sent on: no stored
 * tag equals the empty string, so keeping it would guarantee an empty page.
 */
export function buildArticleFilter(
  query: ListArticlesQueryDto,
): ArticleListFilter {
  const tag = query.tag === undefined ? undefined : normalizeTag(query.tag);

  return {
    ...(tag ? { tag } : {}),
    ...(query.author === undefined ? {} : { author: query.author }),
    ...(query.favorited === undefined ? {} : { favorited: query.favorited }),
  };
}

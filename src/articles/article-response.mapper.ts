import { Injectable } from '@nestjs/common';
import { ArticleRecord } from './article-select';
import { ArticleResponse } from './interfaces/article-response.interface';

@Injectable()
export class ArticleResponseMapper {
  toResponse(article: ArticleRecord): ArticleResponse {
    return {
      slug: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList: article.tagList.map(({ name }) => name),
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      favorited: article.favoritedBy.length > 0,
      favoritesCount: article._count.favoritedBy,
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: article.author.image,
        following: article.author.followedBy.length > 0,
      },
    };
  }

  toResponseList(articles: ArticleRecord[]): ArticleResponse[] {
    return articles.map((article) => this.toResponse(article));
  }
}

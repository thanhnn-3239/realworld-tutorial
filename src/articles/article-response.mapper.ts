import { Injectable } from '@nestjs/common';
import { ArticleRecord } from './articles.repository';
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
      favorited: false,
      favoritesCount: article._count.favoritedBy,
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: article.author.image,
        following: false,
      },
    };
  }
}

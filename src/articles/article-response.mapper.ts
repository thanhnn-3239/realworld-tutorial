import { Injectable } from '@nestjs/common';
import { ArticleRecord } from './articles.repository';
import { ArticleResponse } from './interfaces/article-response.interface';
import { FileStorageService } from '../file-storage/file-storage.service';

@Injectable()
export class ArticleResponseMapper {
  constructor(private readonly fileStorage: FileStorageService) {}

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
        image: this.fileStorage.publicUrl(article.author.image),
        following: article.author.followedBy.length > 0,
      },
    };
  }

  toResponseList(articles: ArticleRecord[]): ArticleResponse[] {
    return articles.map((article) => this.toResponse(article));
  }
}

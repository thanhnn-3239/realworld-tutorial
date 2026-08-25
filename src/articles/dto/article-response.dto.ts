import { ApiProperty } from '@nestjs/swagger';
import {
  ArticleAuthorResponse,
  ArticleResponse,
} from '../interfaces/article-response.interface';

export class ArticleAuthorResponseDto implements ArticleAuthorResponse {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ nullable: true, example: 'I work at statefarm' })
  bio: string | null;

  @ApiProperty({ nullable: true, example: 'https://example.com/avatar.png' })
  image: string | null;

  @ApiProperty({ example: false })
  following: boolean;
}

export class ArticleResponseDto implements ArticleResponse {
  @ApiProperty({ example: 'how-to-train-your-dragon' })
  slug: string;

  @ApiProperty({ example: 'How to train your dragon' })
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  description: string;

  @ApiProperty({ example: 'You have to believe' })
  body: string;

  @ApiProperty({ type: [String], example: ['dragons', 'nestjs'] })
  tagList: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ example: false })
  favorited: boolean;

  @ApiProperty({ example: 0 })
  favoritesCount: number;

  @ApiProperty({ type: ArticleAuthorResponseDto })
  author: ArticleAuthorResponseDto;
}

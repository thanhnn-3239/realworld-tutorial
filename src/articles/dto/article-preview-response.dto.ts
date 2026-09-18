import { ApiProperty } from '@nestjs/swagger';

export class ArticlePreviewResponseDto {
  @ApiProperty({ example: 'NestJS gRPC' })
  excerpt: string;

  @ApiProperty({ example: 2 })
  wordCount: number;

  @ApiProperty({ example: 1 })
  readingTimeMinutes: number;
}

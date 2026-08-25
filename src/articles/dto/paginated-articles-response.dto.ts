import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/api-response.dto';
import { ArticleResponseDto } from './article-response.dto';

export class PaginatedArticlesResponseDto {
  @ApiProperty({ type: [ArticleResponseDto] })
  data: ArticleResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

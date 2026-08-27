import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, ValidateIf } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from '../../common/dto/api-response.dto';

export class ListArticlesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'dragons',
    description: 'Trimmed and lowercased before matching, as tags are on write',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Tag',
    }),
  })
  tag?: string;

  @ApiPropertyOptional({ example: 'jake', description: 'Exact username' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Author',
    }),
  })
  author?: string;

  @ApiPropertyOptional({
    example: 'jake',
    description: 'Exact username of a user who favorited the article',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Favorited',
    }),
  })
  favorited?: string;
}

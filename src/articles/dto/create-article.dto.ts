import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import { IsArray, IsString, Matches, ValidateIf } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'How to train your dragon' })
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Title',
    }),
  })
  @Matches(/\S/u, {
    message: i18nValidationMessage('common.validation.nonBlank', {
      field: 'Title',
    }),
  })
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Description',
    }),
  })
  @Matches(/\S/u, {
    message: i18nValidationMessage('common.validation.nonBlank', {
      field: 'Description',
    }),
  })
  description: string;

  @ApiProperty({ example: 'You have to believe' })
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Body',
    }),
  })
  @Matches(/\S/u, {
    message: i18nValidationMessage('common.validation.nonBlank', {
      field: 'Body',
    }),
  })
  body: string;

  @ApiPropertyOptional({ type: [String], example: ['nestjs', 'prisma'] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Tag list',
    }),
  })
  @IsString({
    each: true,
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Tag',
    }),
  })
  tagList?: string[];
}

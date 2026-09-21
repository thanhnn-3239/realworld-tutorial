import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class PreviewArticleDto {
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
}

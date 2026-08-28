import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import { IsString, Matches, MaxLength } from 'class-validator';

const MAX_COMMENT_BODY_LENGTH = 255;

export class CreateCommentDto {
  @ApiProperty({
    example: 'It takes a Jacobian',
    maxLength: MAX_COMMENT_BODY_LENGTH,
  })
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
  @MaxLength(MAX_COMMENT_BODY_LENGTH, {
    message: i18nValidationMessage('common.validation.maxLength', {
      field: 'Body',
      max: MAX_COMMENT_BODY_LENGTH,
    }),
  })
  body: string;
}

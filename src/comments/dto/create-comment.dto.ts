import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import { IsString, Matches } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'It takes a Jacobian' })
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

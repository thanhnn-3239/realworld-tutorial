import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ConfirmProviderLinkDto {
  @ApiProperty({
    description: 'Opaque token from the provider-link confirmation email',
    example: 'q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU',
    minLength: 43,
    maxLength: 43,
  })
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Token',
    }),
  })
  @Length(43, 43, {
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Token',
    }),
  })
  token: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'q1w2e3r4t5y6u7i8o9p0-_AbCdEfGhIjKlMnOpQrStU',
    description:
      'The refresh token returned by login, register or a prior refresh',
  })
  @IsString()
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Refresh token',
    }),
  })
  refreshToken: string;
}

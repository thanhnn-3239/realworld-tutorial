import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @NormalizeEmail()
  @IsEmail({}, { message: i18nValidationMessage('common.validation.email') })
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Email',
    }),
  })
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Password',
    }),
  })
  password: string;
}

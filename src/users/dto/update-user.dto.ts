import { ApiPropertyOptional } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AUTH_VALIDATION } from '../../auth/auth.config';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'User email address',
  })
  @IsOptional()
  @IsEmail({}, { message: i18nValidationMessage('common.validation.email') })
  email?: string;

  @ApiPropertyOptional({
    example: 'newusername',
    description: 'Unique username',
    minLength: AUTH_VALIDATION.username.minLength,
    maxLength: AUTH_VALIDATION.username.maxLength,
  })
  @IsOptional()
  @IsString()
  @MinLength(AUTH_VALIDATION.username.minLength, {
    message: i18nValidationMessage('common.validation.minLength', {
      field: 'Username',
      min: AUTH_VALIDATION.username.minLength,
    }),
  })
  @MaxLength(AUTH_VALIDATION.username.maxLength, {
    message: i18nValidationMessage('common.validation.maxLength', {
      field: 'Username',
      max: AUTH_VALIDATION.username.maxLength,
    }),
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'I like to code',
    description: 'User bio',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User profile image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: i18nValidationMessage('common.validation.invalid', { field: 'Image URL' }) })
  image?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AUTH_VALIDATION } from '../../auth/auth.config';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'User email address',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail({}, { message: i18nValidationMessage('common.validation.email') })
  email?: string;

  @ApiPropertyOptional({
    example: 'newusername',
    description: 'Unique username',
    minLength: AUTH_VALIDATION.username.minLength,
    maxLength: AUTH_VALIDATION.username.maxLength,
  })
  @ValidateIf((_, value) => value !== undefined)
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
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Username',
    }),
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'new-password123',
    description: `New password (min ${AUTH_VALIDATION.password.minLength} characters). Hashed before it is stored.`,
    minLength: AUTH_VALIDATION.password.minLength,
    maxLength: AUTH_VALIDATION.password.maxLength,
  })
  @ValidateIf((_, value) => value !== undefined)
  @MinLength(AUTH_VALIDATION.password.minLength, {
    message: i18nValidationMessage('common.validation.minLength', {
      field: 'Password',
      min: AUTH_VALIDATION.password.minLength,
    }),
  })
  @MaxLength(AUTH_VALIDATION.password.maxLength, {
    message: i18nValidationMessage('common.validation.maxLength', {
      field: 'Password',
      max: AUTH_VALIDATION.password.maxLength,
    }),
  })
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Password',
    }),
  })
  password?: string;

  @ApiPropertyOptional({
    example: 'I like to code',
    description: 'User bio. Send null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('common.validation.invalid', {
      field: 'Bio',
    }),
  })
  bio?: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User profile image URL. Send null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @IsUrl(
    {},
    {
      message: i18nValidationMessage('common.validation.invalid', {
        field: 'Image URL',
      }),
    },
  )
  image?: string | null;
}

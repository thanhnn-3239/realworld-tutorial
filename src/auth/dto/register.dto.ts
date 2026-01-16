import { ApiProperty } from '@nestjs/swagger';
import { i18nValidationMessage } from 'nestjs-i18n';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AUTH_VALIDATION } from '../auth.config';
import { Match } from '../../common/decorators/match.decorator';

export class RegisterDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: i18nValidationMessage('common.validation.email') })
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Email',
    }),
  })
  email: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Unique username',
    minLength: AUTH_VALIDATION.username.minLength,
    maxLength: AUTH_VALIDATION.username.maxLength,
  })
  @IsString()
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Username',
    }),
  })
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
  username: string;

  @ApiProperty({
    example: 'password123',
    description: `User password (min ${AUTH_VALIDATION.password.minLength} characters)`,
    minLength: AUTH_VALIDATION.password.minLength,
  })
  @IsString()
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Password',
    }),
  })
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
  password: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password confirmation - must match password field',
    minLength: AUTH_VALIDATION.password.minLength,
  })
  @IsString()
  @IsNotEmpty({
    message: i18nValidationMessage('common.validation.required', {
      field: 'Password confirmation',
    }),
  })
  @Match('password', {
    message: i18nValidationMessage('common.validation.match', {
      field: 'Password confirmation',
      relatedField: 'password',
    }),
  })
  password_confirmation: string;
}

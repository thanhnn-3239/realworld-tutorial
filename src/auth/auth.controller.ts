import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ConfirmProviderLinkDto } from './dto/confirm-provider-link.dto';
import { ProviderLinkConfirmedResponseDto } from './dto/provider-link-confirmed-response.dto';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User registered successfully')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Create a new user account with email, username, and password. Returns user information with JWT token.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already exists',
    schema: {
      example: {
        statusCode: 409,
        message: 'Email already exists',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error - invalid input data',
    schema: {
      example: {
        statusCode: 422,
        message: 'Validation Error',
        errors: {
          email: 'Please provide a valid email address',
          password: 'Password must be at least 6 characters',
        },
      },
    },
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticate user with email and password. Returns user information with JWT token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials - email or password is incorrect',
    schema: {
      example: {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid credentials',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error - invalid input data',
    schema: {
      example: {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Validation Error',
        errors: {
          email: 'email must be an email',
          password: 'password should not be empty',
        },
      },
    },
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('google/link/confirm')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Google account link confirmed')
  @ApiOperation({
    summary: 'Confirm a pending Google account link',
    description:
      'Consumes the token from the confirmation email. The caller must repeat Google sign-in to receive tokens.',
  })
  @ApiBody({ type: ConfirmProviderLinkDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The Google account link is confirmed',
    type: ProviderLinkConfirmedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The confirmation token is invalid, expired, or consumed',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'The provider account is linked to another user',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The token is missing or malformed',
  })
  confirmGoogleLink(@Body() dto: ConfirmProviderLinkDto) {
    return this.authService.confirmGoogleLink(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token refreshed successfully')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description:
      'Rotates the presented refresh token. The presented token is spent: replaying it revokes every session for that user, so a failed refresh must never be retried with the old value.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'A new token pair',
    type: TokenPairDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token is unknown, expired, revoked or already spent',
    schema: {
      example: {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Invalid refresh token',
      },
    },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke one refresh token',
    description:
      'Idempotent: an unknown or already-revoked token still reports success, because the caller is logged out either way.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The token is no longer usable',
  })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto);
  }
}

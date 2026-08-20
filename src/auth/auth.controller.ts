import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ResponseMessage } from '../common/decorators/response-message.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
          email: 'email must be an email',
          password: 'password must be longer than or equal to 8 characters',
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
}

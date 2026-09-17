import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { avatarFileFilter } from './avatar-file-filter';
import { USER_AVATAR_MAX_SIZE_BYTES } from './constants/avatar-upload.constants';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing token',
  })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update current user' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'newusername' },
        bio: { type: 'string', nullable: true, example: 'I like to code' },
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Upload a JPEG, PNG, or WebP image (multipart) to set the avatar, or send null (JSON) to remove it — a string is rejected. ' +
            'The decoded image is re-encoded to a 512x512 WebP before storage.',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Unsupported declared MIME type for the uploaded file',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Username already in use',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description:
      'Validation error, or the uploaded bytes failed decoded image validation',
  })
  @ApiResponse({
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    description: 'File too large (max 5 MB)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'File upload failed',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Image processing is temporarily unavailable',
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: USER_AVATAR_MAX_SIZE_BYTES },
      fileFilter: avatarFileFilter,
    }),
  )
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateUser(user.id, dto, file);
  }
}

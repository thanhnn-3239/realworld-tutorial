import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalCurrentUser } from '../auth/decorators/optional-current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ProfilesService } from './profiles.service';
import { ProfileResponseDto } from './dto/profile-response.dto';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({ summary: 'Get a user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile retrieved',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
  })
  getProfile(
    @OptionalCurrentUser() user: JwtPayload | undefined,
    @Param('username') username: string,
  ) {
    return this.profilesService.getProfile(username, user?.id);
  }

  @Post(':username/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Followed successfully')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Followed',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Cannot follow yourself',
  })
  followUser(
    @CurrentUser() user: JwtPayload,
    @Param('username') username: string,
  ) {
    return this.profilesService.followUser(user.id, username);
  }

  @Delete(':username/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Unfollowed successfully')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Unfollowed',
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
  })
  unfollowUser(
    @CurrentUser() user: JwtPayload,
    @Param('username') username: string,
  ) {
    return this.profilesService.unfollowUser(user.id, username);
  }
}

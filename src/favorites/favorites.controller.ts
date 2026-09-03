import {
  Controller,
  Delete,
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
import { ArticleResponseDto } from '../articles/dto/article-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@Controller('articles/:slug/favorite')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article favorited successfully')
  @ApiOperation({ summary: 'Favorite an article' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Article favorited',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  favorite(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.favoritesService.favorite(user.id, slug);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article unfavorited successfully')
  @ApiOperation({ summary: 'Unfavorite an article' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Article unfavorited',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  unfavorite(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.favoritesService.unfavorite(user.id, slug);
  }
}

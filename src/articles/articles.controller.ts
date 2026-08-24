import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ArticlesService } from './articles.service';
import { ArticleResponseDto } from './dto/article-response.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Article created successfully')
  @ApiOperation({ summary: 'Create an article' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Article created',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug conflict' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateArticleDto) {
    return this.articlesService.create(user.id, dto);
  }

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article retrieved successfully')
  @ApiOperation({ summary: 'Get an article by slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Article retrieved',
    type: ArticleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  getBySlug(@Param('slug') slug: string) {
    return this.articlesService.getBySlug(slug);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article updated successfully')
  @ApiOperation({ summary: 'Partially update an owned article' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Article updated',
    type: ArticleResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the author' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slug conflict' })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error or empty update',
  })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.articlesService.update(user.id, slug, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Article deleted successfully')
  @ApiOperation({ summary: 'Delete an owned article' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Article deleted' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Not the author' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  remove(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.articlesService.remove(user.id, slug);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Comments retrieved successfully')
  @ApiOperation({ summary: 'List an article comments' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comments retrieved',
    type: CommentResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  list(@Param('slug') slug: string) {
    return this.commentsService.list(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Comment created successfully')
  @ApiOperation({ summary: 'Add a comment to an article' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comment created',
    type: CommentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article not found',
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Validation error',
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.id, slug, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Comment deleted successfully')
  @ApiOperation({ summary: 'Delete an owned comment from an article' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Comment deleted' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not the comment author',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Article or comment not found',
  })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) commentId: number,
  ) {
    return this.commentsService.remove(user.id, slug, commentId);
  }
}

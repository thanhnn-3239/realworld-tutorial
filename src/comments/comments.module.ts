import { Module } from '@nestjs/common';
import { ArticlesModule } from '../articles/articles.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommentResponseMapper } from './comment-response.mapper';
import { CommentsController } from './comments.controller';
import { CommentsRepository } from './comments.repository';
import { CommentsService } from './comments.service';

@Module({
  imports: [PrismaModule, AuthModule, ArticlesModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsRepository, CommentResponseMapper],
})
export class CommentsModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ArticleResponseMapper } from './article-response.mapper';
import { ArticleSlugService } from './article-slug.service';
import { ArticlesController } from './articles.controller';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ArticlesController],
  providers: [
    ArticlesService,
    ArticlesRepository,
    ArticleSlugService,
    ArticleResponseMapper,
  ],
  exports: [ArticlesService, ArticlesRepository, ArticleResponseMapper],
})
export class ArticlesModule {}
